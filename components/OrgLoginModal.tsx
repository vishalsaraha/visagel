import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Vibration,
  ScrollView,
} from 'react-native';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { OrgPlatformAccount, saveOrgPlatformAccountDb } from '@/utils/database';

interface OrgLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (account: OrgPlatformAccount) => void;
  initialAccount: OrgPlatformAccount;
}

const THEME_COLOR = '#FF6900';

export default function OrgLoginModal({
  visible,
  onClose,
  onSuccess,
  initialAccount,
}: OrgLoginModalProps) {
  const [orgEmail, setOrgEmail] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setOrgEmail(initialAccount.orgEmail || '');
      setOrgId(initialAccount.orgId || '');
      setPassword(initialAccount.password || '');
      setErrorMessage('');
      setShowPassword(false);
    }
  }, [visible, initialAccount]);

  const handleOrgLogin = () => {
    const trimmedEmail = orgEmail.trim();
    const trimmedId = orgId.trim();
    const trimmedPass = password.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter Organisation Email');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setErrorMessage('Please enter a valid Organisation Email');
      return;
    }
    if (!trimmedId) {
      setErrorMessage('Please enter Organisation ID from platform provider');
      return;
    }
    if (!trimmedPass) {
      setErrorMessage('Please enter Organisation Password');
      return;
    }

    const updatedAccount: OrgPlatformAccount = {
      orgId: trimmedId,
      orgEmail: trimmedEmail,
      password: trimmedPass,
      isLoggedIn: true,
      providerName: 'Branzept Cloud Platform',
      connectedAt: new Date().toISOString(),
    };

    saveOrgPlatformAccountDb(updatedAccount);
    onSuccess(updatedAccount);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <FontAwesome name="close" size={16} color="#64748B" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }}>
            {/* Platform Provider Badge */}
            <View style={styles.badgePill}>
              <MaterialCommunityIcons name="cloud-check" size={12} color={THEME_COLOR} style={{ marginRight: 4 }} />
              <Text style={styles.badgePillText}>PLATFORM PROVIDER AUTH</Text>
            </View>

            {/* Icon */}
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="office-building-cog" size={28} color={THEME_COLOR} />
            </View>

            {/* Titles */}
            <Text style={styles.title}>Organisation Login</Text>
            <Text style={styles.subtitle}>
              Sign in with Organisation Email, Org ID & Password provided by platform provider
            </Text>

            {/* Field 1: Organisation Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Organisation Email</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="email-outline" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. admin@branzept.com"
                  placeholderTextColor="#94A3B8"
                  value={orgEmail}
                  onChangeText={(text) => {
                    setOrgEmail(text);
                    setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Field 2: Organisation ID */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Organisation ID (Provided by Provider)</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="domain" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. BRZ-ORG-8821"
                  placeholderTextColor="#94A3B8"
                  value={orgId}
                  onChangeText={(text) => {
                    setOrgId(text);
                    setErrorMessage('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Field 3: Organisation Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Organisation Password</Text>
              <View style={[styles.inputWrapper, errorMessage ? styles.inputWrapperError : null]}>
                <MaterialCommunityIcons name="lock-outline" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter organisation password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleOrgLogin}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Status / Error Box */}
            <View style={styles.statusBox}>
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : (
                <Text style={styles.hintText}>Requires Org ID & Email issued by platform</Text>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText} numberOfLines={1}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.submitBtn]}
                onPress={handleOrgLogin}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText} numberOfLines={1} adjustsFontSizeToFit>Connect Org</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginBottom: 10,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME_COLOR,
    letterSpacing: 0.8,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
    lineHeight: 16,
  },
  fieldWrap: {
    width: '100%',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
  },
  statusBox: {
    minHeight: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  submitBtn: {
    backgroundColor: THEME_COLOR,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
