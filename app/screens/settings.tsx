import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [faceRecognitionAuto, setFaceRecognitionAuto] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => {} },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerUnderline} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Organization / Profile Info Section */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <FontAwesome name="building" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Visagel Face Attendance System</Text>
            <Text style={styles.profileSubtitle}>Created by Branzept</Text>
          </View>
        </View>

        {/* Preferences Category */}
        <Text style={styles.sectionCategory}>Preferences</Text>

        <View style={styles.cardContainer}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome name="bell" size={16} color="#6B7280" style={styles.settingIcon} />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#E5E7EB', true: '#00A86B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome name="camera" size={16} color="#6B7280" style={styles.settingIcon} />
              <Text style={styles.settingText}>Auto Face Recognition</Text>
            </View>
            <Switch
              value={faceRecognitionAuto}
              onValueChange={setFaceRecognitionAuto}
              trackColor={{ false: '#E5E7EB', true: '#00A86B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome name="moon-o" size={16} color="#6B7280" style={styles.settingIcon} />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#E5E7EB', true: '#00A86B' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* System Category */}
        <Text style={styles.sectionCategory}>System & Support</Text>

        <View style={styles.cardContainer}>
          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome name="database" size={16} color="#6B7280" style={styles.settingIcon} />
              <Text style={styles.settingText}>Sync Attendance Records</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome name="shield" size={16} color="#6B7280" style={styles.settingIcon} />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome name="info-circle" size={16} color="#6B7280" style={styles.settingIcon} />
              <Text style={styles.settingText}>App Version (1.0.0)</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <FontAwesome name="sign-out" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A192F',
  },
  headerUnderline: {
    width: 30,
    height: 3,
    backgroundColor: '#00A86B',
    marginTop: 6,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 90,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00A86B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  sectionCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 22,
    marginRight: 12,
    textAlign: 'center',
  },
  settingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});