import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Vibration,
} from 'react-native';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminAccount } from '@/context/AuthContext';

interface AuthPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  verifyPassword: (password: string, loginOrEmail?: string) => { success: boolean; user?: AdminAccount };
  title?: string;
  subtitle?: string;
  badgeText?: string;
}

const THEME_COLOR = '#FF6900';

export default function AuthPasswordModal({
  visible,
  onClose,
  onSuccess,
  verifyPassword,
  title = 'HR Admin Login',
  subtitle = 'Enter HR ID & Password to unlock',
  badgeText = 'HR ACCESS LOCK',
}: AuthPasswordModalProps) {
  const [loginIdOrEmail, setLoginIdOrEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setLoginIdOrEmail('');
      setPassword('');
      setErrorMessage('');
      setShowPassword(false);
    }
  }, [visible]);

  const handleLogin = () => {
    if (!password) {
      setErrorMessage('Please enter password');
      return;
    }

    const res = verifyPassword(password, loginIdOrEmail.trim() ? loginIdOrEmail.trim() : undefined);
    if (res.success) {
      setPassword('');
      setLoginIdOrEmail('');
      setErrorMessage('');
      onSuccess();
    } else {
      Vibration.vibrate(100);
      setErrorMessage('Incorrect HR ID or Password');
      setPassword('');
    }
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

          {/* HR Access Badge */}
          <View style={styles.badgePill}>
            <MaterialCommunityIcons name="shield-lock" size={12} color={THEME_COLOR} style={{ marginRight: 4 }} />
            <Text style={styles.badgePillText}>{badgeText}</Text>
          </View>

          {/* HR Shield Icon */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-lock-outline" size={28} color={THEME_COLOR} />
          </View>

          {/* Titles */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* HR ID or Email Input Box */}
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="account-tie-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="HR Login ID or Email"
              placeholderTextColor="#94A3B8"
              value={loginIdOrEmail}
              onChangeText={(text) => {
                setLoginIdOrEmail(text);
                setErrorMessage('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              autoFocus={true}
            />
          </View>

          {/* Password Input Box */}
          <View style={[styles.inputWrapper, { marginTop: 10 }, errorMessage ? styles.inputWrapperError : null]}>
            <MaterialCommunityIcons name="lock-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage('');
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleLogin}
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

          {/* Error / Hint text */}
          <View style={styles.statusBox}>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : (
              <Text style={styles.hintText}>Default: admin / admin</Text>
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
              onPress={handleLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText} numberOfLines={1} adjustsFontSizeToFit>Unlock Console</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 350,
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
    marginBottom: 12,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME_COLOR,
    letterSpacing: 0.8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
  },
  statusBox: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
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
