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
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME_COLOR = '#FF6900';
const THEME_COLOR_10_OPACITY = 'rgba(255, 105, 0, 0.1)';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [faceRecognitionAuto, setFaceRecognitionAuto] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Shift & Timing State
  const defaultStartTime = new Date();
  defaultStartTime.setHours(9, 0, 0, 0);
  const defaultEndTime = new Date();
  defaultEndTime.setHours(18, 0, 0, 0);
  const defaultCutoffTime = new Date();
  defaultCutoffTime.setHours(9, 30, 0, 0);

  const [shiftStartTime, setShiftStartTime] = useState<Date>(defaultStartTime);
  const [shiftEndTime, setShiftEndTime] = useState<Date>(defaultEndTime);
  const [lateCutoffTime, setLateCutoffTime] = useState<Date>(defaultCutoffTime);

  // Time Picker modal states
  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    mode: 'time' | 'date';
    title: string;
    value: Date;
    onSave: (d: Date) => void;
  }>({
    visible: false,
    mode: 'time',
    title: 'Select Time',
    value: new Date(),
    onSave: () => {},
  });

  const formatTime = (d: Date) => {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const openTimePicker = (title: string, value: Date, onSave: (d: Date) => void) => {
    setPickerConfig({
      visible: true,
      mode: 'time',
      title,
      value,
      onSave,
    });
  };

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
            <FontAwesome name="building" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Visagel Face Attendance System</Text>
            <View style={styles.profileSubtitleRow}>
              <MaterialCommunityIcons name="shield-check" size={13} color={THEME_COLOR} style={{ marginRight: 4 }} />
              <Text style={styles.profileSubtitle}>Powered by Branzept</Text>
            </View>
          </View>
        </View>

        {/* Shift Timings Category */}
        <Text style={styles.sectionCategory}>Shift & Attendance Hours</Text>

        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={styles.timeSettingRow}
            activeOpacity={0.7}
            onPress={() =>
              openTimePicker('Set Shift Start Time', shiftStartTime, (d) => setShiftStartTime(d))
            }
          >
            <View style={styles.settingLabelContainer}>
              <View style={styles.iconCircleWrapper}>
                <FontAwesome name="clock-o" size={15} color={THEME_COLOR} />
              </View>
              <View>
                <Text style={styles.settingText}>Shift Start Time</Text>
                <Text style={styles.settingSubtext}>Standard check-in time</Text>
              </View>
            </View>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{formatTime(shiftStartTime)}</Text>
              <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity
            style={styles.timeSettingRow}
            activeOpacity={0.7}
            onPress={() =>
              openTimePicker('Set Shift End Time', shiftEndTime, (d) => setShiftEndTime(d))
            }
          >
            <View style={styles.settingLabelContainer}>
              <View style={styles.iconCircleWrapper}>
                <FontAwesome name="hourglass-end" size={14} color={THEME_COLOR} />
              </View>
              <View>
                <Text style={styles.settingText}>Shift End Time</Text>
                <Text style={styles.settingSubtext}>Standard check-out time</Text>
              </View>
            </View>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{formatTime(shiftEndTime)}</Text>
              <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity
            style={styles.timeSettingRow}
            activeOpacity={0.7}
            onPress={() =>
              openTimePicker('Set Late Cutoff Time', lateCutoffTime, (d) => setLateCutoffTime(d))
            }
          >
            <View style={styles.settingLabelContainer}>
              <View style={styles.iconCircleWrapper}>
                <FontAwesome name="bell-o" size={15} color={THEME_COLOR} />
              </View>
              <View>
                <Text style={styles.settingText}>Late Mark Threshold</Text>
                <Text style={styles.settingSubtext}>Marked late after this time</Text>
              </View>
            </View>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{formatTime(lateCutoffTime)}</Text>
              <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences Category */}
        <Text style={styles.sectionCategory}>Preferences</Text>

        <View style={styles.cardContainer}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconCircleWrapper, { backgroundColor: '#F1F5F9' }]}>
                <FontAwesome name="bell" size={14} color="#64748B" />
              </View>
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconCircleWrapper, { backgroundColor: '#F1F5F9' }]}>
                <FontAwesome name="camera" size={14} color="#64748B" />
              </View>
              <Text style={styles.settingText}>Auto Face Recognition</Text>
            </View>
            <Switch
              value={faceRecognitionAuto}
              onValueChange={setFaceRecognitionAuto}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconCircleWrapper, { backgroundColor: '#F1F5F9' }]}>
                <FontAwesome name="moon-o" size={15} color="#64748B" />
              </View>
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* System Category */}
        <Text style={styles.sectionCategory}>System & Support</Text>

        <View style={styles.cardContainer}>
          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconCircleWrapper, { backgroundColor: '#F1F5F9' }]}>
                <FontAwesome name="database" size={14} color="#64748B" />
              </View>
              <Text style={styles.settingText}>Sync Attendance Records</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconCircleWrapper, { backgroundColor: '#F1F5F9' }]}>
                <FontAwesome name="shield" size={14} color="#64748B" />
              </View>
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconCircleWrapper, { backgroundColor: '#F1F5F9' }]}>
                <FontAwesome name="info-circle" size={14} color="#64748B" />
              </View>
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

      {/* Cross-Platform Visagel Branded Time / Date Picker Modal */}
      <AppDateTimePicker
        visible={pickerConfig.visible}
        mode={pickerConfig.mode}
        value={pickerConfig.value}
        title={pickerConfig.title}
        themeColor={THEME_COLOR}
        onChange={(selectedDate) => {
          pickerConfig.onSave(selectedDate);
        }}
        onClose={() => setPickerConfig((prev) => ({ ...prev, visible: false }))}
      />
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
    fontSize: 24,
    fontWeight: '700',
    color: '#0A192F',
  },
  headerUnderline: {
    width: 35,
    height: 3,
    backgroundColor: THEME_COLOR,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 2,
  },
  profileSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  timeSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  iconCircleWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME_COLOR_10_OPACITY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLOR_10_OPACITY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 0, 0.25)',
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME_COLOR,
  },
  settingSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
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
    flex: 1,
  },
  settingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
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