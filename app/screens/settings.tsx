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
  Modal,
  Linking,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAttendance } from '@/context/AttendanceContext';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME_COLOR = '#FF6900';
const THEME_COLOR_10_OPACITY = 'rgba(255, 105, 0, 0.1)';
const NIGHT_COLOR = '#6366F1';
const NIGHT_COLOR_10 = 'rgba(99, 102, 241, 0.1)';

// --------------- Types ---------------
interface ShiftEntry {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  lateCutoff: Date;
  isActive: boolean;
}

// Helper: detect night shift (end time is before start time → crosses midnight)
function isNightShift(start: Date, end: Date): boolean {
  const startMins = start.getHours() * 60 + start.getMinutes();
  const endMins = end.getHours() * 60 + end.getMinutes();
  return endMins <= startMins;
}

// Format a Date as h:mm AM/PM
function formatTime(d: Date): string {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

// Build a Date with given h:mm
function makeTime(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Default shifts
const DEFAULT_SHIFTS: ShiftEntry[] = [
  {
    id: '1',
    name: 'Day Shift',
    startTime: makeTime(9, 0),
    endTime: makeTime(18, 0),
    lateCutoff: makeTime(9, 30),
    isActive: true,
  },
  {
    id: '2',
    name: 'Night Shift',
    startTime: makeTime(21, 0),
    endTime: makeTime(6, 0),
    lateCutoff: makeTime(21, 30),
    isActive: false,
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { adminPassword, updatePassword, logout } = useAuth();
  const { multipleTimeEntries, setMultipleTimeEntries } = useAttendance();

  // Feature toggles
  const [autoFaceDetection, setAutoFaceDetection] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [sendReportsDaily, setSendReportsDaily] = useState(false);

  // Shift list
  const [shifts, setShifts] = useState<ShiftEntry[]>(DEFAULT_SHIFTS);

  // Modals
  const [manageShiftsVisible, setManageShiftsVisible] = useState(false);
  const [shiftFormVisible, setShiftFormVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftEntry | null>(null);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Shift form fields
  const [formName, setFormName] = useState('');
  const [formStart, setFormStart] = useState<Date>(makeTime(9, 0));
  const [formEnd, setFormEnd] = useState<Date>(makeTime(18, 0));
  const [formLateCutoff, setFormLateCutoff] = useState<Date>(makeTime(9, 30));

  // Time picker
  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    title: string;
    value: Date;
    onSave: (d: Date) => void;
  }>({
    visible: false,
    title: 'Select Time',
    value: new Date(),
    onSave: () => {},
  });

  const openTimePicker = (title: string, value: Date, onSave: (d: Date) => void) => {
    setPickerConfig({ visible: true, title, value, onSave });
  };

  // ---------- Shift CRUD ----------
  const openAddShift = () => {
    setEditingShift(null);
    setFormName('');
    setFormStart(makeTime(9, 0));
    setFormEnd(makeTime(18, 0));
    setFormLateCutoff(makeTime(9, 30));
    setShiftFormVisible(true);
  };

  const openEditShift = (shift: ShiftEntry) => {
    setEditingShift(shift);
    setFormName(shift.name);
    setFormStart(new Date(shift.startTime));
    setFormEnd(new Date(shift.endTime));
    setFormLateCutoff(new Date(shift.lateCutoff));
    setShiftFormVisible(true);
  };

  const saveShift = () => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Please enter a shift name.');
      return;
    }
    if (editingShift) {
      setShifts((prev) =>
        prev.map((s) =>
          s.id === editingShift.id
            ? { ...s, name: formName.trim(), startTime: formStart, endTime: formEnd, lateCutoff: formLateCutoff }
            : s
        )
      );
    } else {
      const newShift: ShiftEntry = {
        id: Date.now().toString(),
        name: formName.trim(),
        startTime: formStart,
        endTime: formEnd,
        lateCutoff: formLateCutoff,
        isActive: false,
      };
      setShifts((prev) => [...prev, newShift]);
    }
    setShiftFormVisible(false);
  };

  const deleteShift = (id: string) => {
    Alert.alert('Delete Shift', 'Are you sure you want to delete this shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setShifts((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  };

  const setActiveShift = (id: string) => {
    setShifts((prev) => prev.map((s) => ({ ...s, isActive: s.id === id })));
  };

  // ---------- Other handlers ----------
  const handleRateUs = () => {
    Alert.alert('Rate Visagel', 'Thank you for rating Visagel on Google Play Store!', [{ text: 'OK' }]);
  };

  const handleHelp = () => {
    Alert.alert(
      'Help & Support',
      'Need assistance with camera configuration or face enrollment?\n\nContact support: support@branzept.com',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@branzept.com') },
      ]
    );
  };

  const activeShift = shifts.find((s) => s.isActive);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.companyBadgeRow}>
              <FontAwesome name="building" size={12} color="#FF6900" style={{ marginRight: 5 }} />
              <Text style={styles.companyNameText}>BRANZEPT</Text>
            </View>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.headerUnderline} />
          </View>
          <TouchableOpacity
            style={styles.lockBtn}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                'Lock Screen',
                'Lock Admin and return to Attendance Screen?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Lock',
                    style: 'destructive',
                    onPress: () => {
                      logout();
                      router.replace('/');
                    },
                  },
                ]
              );
            }}
          >
            <FontAwesome name="lock" size={13} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Company Profile Banner */}
        <View style={styles.companyBannerCard}>
          <View style={styles.companyIconLargeBox}>
            <FontAwesome name="building" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.companyBannerPreTitle}>REGISTERED COMPANY</Text>
            <Text style={styles.companyBannerMainTitle}>BRANZEPT</Text>
            <View style={styles.companySystemBadge}>
              <MaterialCommunityIcons name="shield-check" size={12} color="#059669" style={{ marginRight: 4 }} />
              <Text style={styles.companySystemBadgeText}>Visagel Attendance System</Text>
            </View>
          </View>
        </View>

        {/* SECTION 1: ATTENDANCE & SHIFTS */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>ATTENDANCE & SCANNING</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* Manage Shifts */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setManageShiftsVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#FF6900" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Work Shifts</Text>
              <Text style={styles.menuDescription}>
                {activeShift ? `Active: ${activeShift.name} (${formatTime(activeShift.startTime)} - ${formatTime(activeShift.endTime)})` : 'Configure shifts & timings'}
              </Text>
            </View>
            <View style={styles.shiftCountPill}>
              <Text style={styles.shiftCountPillText}>{shifts.length} Shifts</Text>
              <FontAwesome name="chevron-right" size={10} color="#94A3B8" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Multiple Time Entries */}
          <View style={styles.menuCardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="clock-fast" size={20} color="#2563EB" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Multi-Punch Entry</Text>
              <Text style={styles.menuDescription}>Allow multiple clock-in and out per day</Text>
            </View>
            <Switch
              value={multipleTimeEntries}
              onValueChange={setMultipleTimeEntries}
              trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Auto Face Detection */}
          <View style={styles.menuCardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <MaterialCommunityIcons name="face-recognition" size={20} color="#059669" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Auto Face Scan</Text>
              <Text style={styles.menuDescription}>Continuous auto-detection via camera</Text>
            </View>
            <Switch
              value={autoFaceDetection}
              onValueChange={setAutoFaceDetection}
              trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Voice Scan Feedback */}
          <View style={styles.menuCardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FDF4FF' }]}>
              <MaterialCommunityIcons name="volume-high" size={20} color="#A855F7" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Voice Audio Feedback</Text>
              <Text style={styles.menuDescription}>Play audio chime on verified attendance</Text>
            </View>
            <Switch
              value={voiceFeedback}
              onValueChange={setVoiceFeedback}
              trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* SECTION 2: CLOUD & REPORTS */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>DATA & SYNC</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* Send reports daily */}
          <View style={styles.menuCardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FFFBEB' }]}>
              <MaterialCommunityIcons name="email-check-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Daily Email Summary</Text>
              <Text style={styles.menuDescription}>Email attendance reports automatically</Text>
            </View>
            <Switch
              value={sendReportsDaily}
              onValueChange={setSendReportsDaily}
              trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Sync Attendance Records */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setSyncModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Cloud Data Sync</Text>
              <Text style={styles.menuDescription}>Backup or restore offline records</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* SECTION 3: SECURITY & ADMIN */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>SECURITY & SYSTEM</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* Admin Password */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setPasswordModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#F8FAFC' }]}>
              <MaterialCommunityIcons name="shield-key-outline" size={20} color="#334155" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Admin Password</Text>
              <Text style={styles.menuDescription}>Change authentication credentials</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Help & Support */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={handleHelp}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="help-circle-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuDescription}>Guides, FAQs & contact support</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* About Us */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setAboutModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#475569" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>About Visagel</Text>
              <Text style={styles.menuDescription}>Version, licenses and company info</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Rate Us */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={handleRateUs}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="star-outline" size={20} color="#F59E0B" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Rate App</Text>
              <Text style={styles.menuDescription}>Support us with a 5-star review</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Lock Screen Action Card */}
        <TouchableOpacity
          style={styles.lockActionCard}
          activeOpacity={0.8}
          onPress={() => {
            Alert.alert(
              'Lock Screen',
              'Lock Admin and return to Attendance Screen?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Lock',
                  style: 'destructive',
                  onPress: () => {
                    logout();
                    router.replace('/');
                  },
                },
              ]
            );
          }}
        >
          <View style={styles.lockIconBox}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.lockCardTitle}>Lock HR Admin</Text>
            <Text style={styles.lockCardSubtitle}>Return to attendance scanner</Text>
          </View>
          <FontAwesome name="sign-out" size={16} color="#EF4444" />
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.versionText}>Visagel Attendance System • Version 1.0.0</Text>
          <Text style={styles.brandTaglineText}>Powered by Branzept Technology</Text>
        </View>
      </ScrollView>

      {/* ===== MANAGE SHIFTS MODAL ===== */}
      <Modal
        visible={manageShiftsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setManageShiftsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Shifts</Text>
                <Text style={styles.modalSubtitle}>{shifts.length} shift{shifts.length !== 1 ? 's' : ''} configured</Text>
              </View>
              <TouchableOpacity onPress={() => setManageShiftsVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="close" size={18} color="#0A192F" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {shifts.map((shift, index) => {
                const night = isNightShift(shift.startTime, shift.endTime);
                const accentColor = night ? NIGHT_COLOR : THEME_COLOR;
                const accentBg = night ? NIGHT_COLOR_10 : THEME_COLOR_10_OPACITY;
                return (
                  <View key={shift.id} style={[styles.shiftCard, shift.isActive && styles.shiftCardActive]}>
                    {/* Active Radio + Name */}
                    <View style={styles.shiftCardHeader}>
                      <TouchableOpacity
                        style={styles.radioRow}
                        onPress={() => setActiveShift(shift.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, shift.isActive && { borderColor: accentColor }]}>
                          {shift.isActive && <View style={[styles.radioFill, { backgroundColor: accentColor }]} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shiftCardName}>{shift.name}</Text>
                          {night && (
                            <View style={styles.nightBadge}>
                              <MaterialCommunityIcons name="weather-night" size={11} color={NIGHT_COLOR} />
                              <Text style={styles.nightBadgeText}>Night Shift • Crosses Midnight</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>

                      {shift.isActive && (
                        <View style={[styles.activePill, { backgroundColor: accentBg, borderColor: accentColor }]}>
                          <Text style={[styles.activePillText, { color: accentColor }]}>Active</Text>
                        </View>
                      )}
                    </View>

                    {/* Shift time details */}
                    <View style={[styles.shiftTimeRow, { backgroundColor: accentBg, borderRadius: 10, padding: 10, marginTop: 8 }]}>
                      <View style={styles.shiftTimeCol}>
                        <Text style={styles.shiftTimeLabel}>Start</Text>
                        <Text style={[styles.shiftTimeValue, { color: accentColor }]}>{formatTime(shift.startTime)}</Text>
                      </View>
                      <MaterialCommunityIcons name="arrow-right" size={16} color="#94A3B8" />
                      <View style={styles.shiftTimeCol}>
                        <Text style={styles.shiftTimeLabel}>End {night ? '(+1 day)' : ''}</Text>
                        <Text style={[styles.shiftTimeValue, { color: accentColor }]}>{formatTime(shift.endTime)}</Text>
                      </View>
                      <View style={styles.shiftTimeDividerV} />
                      <View style={styles.shiftTimeCol}>
                        <Text style={styles.shiftTimeLabel}>Late After</Text>
                        <Text style={[styles.shiftTimeValue, { color: accentColor }]}>{formatTime(shift.lateCutoff)}</Text>
                      </View>
                    </View>

                    {/* Edit / Delete buttons */}
                    <View style={styles.shiftCardActions}>
                      <TouchableOpacity
                        style={[styles.shiftActionBtn, { borderColor: accentColor }]}
                        onPress={() => openEditShift(shift)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome name="pencil" size={12} color={accentColor} />
                        <Text style={[styles.shiftActionText, { color: accentColor }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.shiftActionBtn, { borderColor: '#EF4444' }]}
                        onPress={() => deleteShift(shift.id)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome name="trash-o" size={12} color="#EF4444" />
                        <Text style={[styles.shiftActionText, { color: '#EF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>

                    {index < shifts.length - 1 && <View style={{ height: 1, backgroundColor: '#F1F5F9', marginTop: 12 }} />}
                  </View>
                );
              })}

              {/* Add Shift Button */}
              <TouchableOpacity style={styles.addShiftBtn} onPress={openAddShift} activeOpacity={0.8}>
                <FontAwesome name="plus" size={14} color={THEME_COLOR} style={{ marginRight: 8 }} />
                <Text style={styles.addShiftBtnText}>Add New Shift</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.doneModalBtn}
              onPress={() => setManageShiftsVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.doneModalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== ADD / EDIT SHIFT FORM MODAL ===== */}
      <Modal
        visible={shiftFormVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShiftFormVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContentSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingShift ? 'Edit Shift' : 'Add New Shift'}</Text>
                <Text style={styles.modalSubtitle}>
                  {isNightShift(formStart, formEnd)
                    ? '🌙 Night shift detected (crosses midnight)'
                    : '☀️ Day shift'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShiftFormVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="close" size={18} color="#0A192F" />
              </TouchableOpacity>
            </View>

            {/* Shift Name */}
            <Text style={styles.formLabel}>Shift Name</Text>
            <TextInput
              style={styles.formInput}
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. Morning Shift, Night Shift"
              placeholderTextColor="#94A3B8"
            />

            {/* Night shift info banner */}
            {isNightShift(formStart, formEnd) && (
              <View style={styles.nightInfoBanner}>
                <MaterialCommunityIcons name="weather-night" size={16} color={NIGHT_COLOR} style={{ marginRight: 8 }} />
                <Text style={styles.nightInfoText}>
                  End time is before start time — this shift crosses midnight and ends the next day.
                </Text>
              </View>
            )}

            <View style={styles.modalBodyCard}>
              {/* Start Time */}
              <TouchableOpacity
                style={styles.shiftSettingRow}
                activeOpacity={0.7}
                onPress={() => openTimePicker('Shift Start Time', formStart, setFormStart)}
              >
                <View style={styles.shiftLabelGroup}>
                  <View style={[styles.miniIconCircle, { backgroundColor: THEME_COLOR_10_OPACITY }]}>
                    <FontAwesome name="clock-o" size={15} color={THEME_COLOR} />
                  </View>
                  <View>
                    <Text style={styles.shiftTitle}>Start Time</Text>
                    <Text style={styles.shiftSub}>When the shift begins</Text>
                  </View>
                </View>
                <View style={styles.shiftTimeBadge}>
                  <Text style={styles.shiftTimeBadgeText}>{formatTime(formStart)}</Text>
                  <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              <View style={styles.shiftDivider} />

              {/* End Time */}
              <TouchableOpacity
                style={styles.shiftSettingRow}
                activeOpacity={0.7}
                onPress={() => openTimePicker('Shift End Time', formEnd, setFormEnd)}
              >
                <View style={styles.shiftLabelGroup}>
                  <View style={[styles.miniIconCircle, { backgroundColor: isNightShift(formStart, formEnd) ? NIGHT_COLOR_10 : THEME_COLOR_10_OPACITY }]}>
                    <FontAwesome name="hourglass-end" size={14} color={isNightShift(formStart, formEnd) ? NIGHT_COLOR : THEME_COLOR} />
                  </View>
                  <View>
                    <Text style={styles.shiftTitle}>
                      End Time {isNightShift(formStart, formEnd) ? '(next day)' : ''}
                    </Text>
                    <Text style={styles.shiftSub}>When the shift ends</Text>
                  </View>
                </View>
                <View style={[styles.shiftTimeBadge, isNightShift(formStart, formEnd) && { backgroundColor: NIGHT_COLOR_10, borderColor: 'rgba(99, 102, 241, 0.25)' }]}>
                  <Text style={[styles.shiftTimeBadgeText, isNightShift(formStart, formEnd) && { color: NIGHT_COLOR }]}>{formatTime(formEnd)}</Text>
                  <FontAwesome name="pencil" size={11} color={isNightShift(formStart, formEnd) ? NIGHT_COLOR : THEME_COLOR} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              <View style={styles.shiftDivider} />

              {/* Late Cutoff */}
              <TouchableOpacity
                style={styles.shiftSettingRow}
                activeOpacity={0.7}
                onPress={() => openTimePicker('Late Mark Cutoff', formLateCutoff, setFormLateCutoff)}
              >
                <View style={styles.shiftLabelGroup}>
                  <View style={[styles.miniIconCircle, { backgroundColor: THEME_COLOR_10_OPACITY }]}>
                    <FontAwesome name="bell-o" size={15} color={THEME_COLOR} />
                  </View>
                  <View>
                    <Text style={styles.shiftTitle}>Late Mark Threshold</Text>
                    <Text style={styles.shiftSub}>Marked late after this time</Text>
                  </View>
                </View>
                <View style={styles.shiftTimeBadge}>
                  <Text style={styles.shiftTimeBadgeText}>{formatTime(formLateCutoff)}</Text>
                  <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.doneModalBtn} onPress={saveShift} activeOpacity={0.85}>
              <Text style={styles.doneModalBtnText}>{editingShift ? 'Save Changes' : 'Add Shift'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== SYNC RECORDS MODAL ===== */}
      <Modal
        visible={syncModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSyncModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'center' }]}>
          <View style={styles.alertCard}>
            <View style={styles.syncAvatar}>
              <MaterialCommunityIcons name="cloud-check" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.planTitle}>Cloud Synchronization</Text>
            <Text style={styles.planSubtitle}>All offline attendance records are up to date and synchronized.</Text>
            <View style={styles.syncStatsBox}>
              <View style={styles.syncStatCol}>
                <Text style={styles.syncStatVal}>100%</Text>
                <Text style={styles.syncStatLabel}>Status</Text>
              </View>
              <View style={styles.syncStatDivider} />
              <View style={styles.syncStatCol}>
                <Text style={styles.syncStatVal}>Live</Text>
                <Text style={styles.syncStatLabel}>Sync Mode</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeAlertBtn} onPress={() => setSyncModalVisible(false)}>
              <Text style={styles.closeAlertBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== PASSWORD MODAL ===== */}
      <Modal
        visible={passwordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setPasswordModalVisible(false);
          setIsChangingPassword(false);
          setNewPasswordInput('');
        }}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'center' }]}>
          <View style={styles.alertCard}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>SECURITY</Text>
            </View>
            <Text style={styles.planTitle}>Admin Password</Text>
            <Text style={styles.planSubtitle}>
              {isChangingPassword
                ? 'Enter new password for Admin access'
                : 'Current admin password is active.'}
            </Text>

            {!isChangingPassword ? (
              <>
                <View style={styles.pinDisplayBox}>
                  <Text style={styles.pinDisplayText}>•••••••• ({adminPassword})</Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeAlertBtn, { backgroundColor: '#F1F5F9', marginBottom: 10 }]}
                  onPress={() => {
                    setNewPasswordInput('');
                    setIsChangingPassword(true);
                  }}
                >
                  <Text style={[styles.closeAlertBtnText, { color: '#0A192F' }]}>Change Password</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeAlertBtn}
                  onPress={() => {
                    setPasswordModalVisible(false);
                    setIsChangingPassword(false);
                    setNewPasswordInput('');
                  }}
                >
                  <Text style={styles.closeAlertBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      textAlign: 'center',
                      fontSize: 16,
                      fontWeight: '700',
                      width: '100%',
                      marginVertical: 12,
                    },
                  ]}
                  value={newPasswordInput}
                  onChangeText={setNewPasswordInput}
                  placeholder="Enter new password"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.closeAlertBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                    onPress={() => {
                      setIsChangingPassword(false);
                      setNewPasswordInput('');
                    }}
                  >
                    <Text style={[styles.closeAlertBtnText, { color: '#64748B' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.closeAlertBtn, { flex: 1, backgroundColor: THEME_COLOR }]}
                    onPress={async () => {
                      if (!newPasswordInput.trim()) {
                        Alert.alert('Invalid', 'Password cannot be empty.');
                        return;
                      }
                      await updatePassword(newPasswordInput);
                      setIsChangingPassword(false);
                      setNewPasswordInput('');
                      Alert.alert('Saved', 'New admin password saved.');
                    }}
                  >
                    <Text style={styles.closeAlertBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== ABOUT MODAL ===== */}
      <Modal
        visible={aboutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'center' }]}>
          <View style={styles.alertCard}>
            <View style={styles.aboutAvatar}>
              <FontAwesome name="building" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.planTitle}>Visagel</Text>
            <Text style={styles.planSubtitle}>Smart Facial Recognition Attendance System</Text>
            <Text style={styles.aboutDesc}>
              Developed by Branzept to deliver fast, secure, and contactless biometric attendance tracking for modern workplaces.
            </Text>
            <Text style={styles.aboutVersion}>Version 1.0.0 • 2026</Text>
            <TouchableOpacity style={styles.closeAlertBtn} onPress={() => setAboutModalVisible(false)}>
              <Text style={styles.closeAlertBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Visagel Time Picker */}
      <AppDateTimePicker
        visible={pickerConfig.visible}
        mode="time"
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
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  companyNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME_COLOR,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: 0.3,
  },
  headerUnderline: {
    width: 32,
    height: 3,
    backgroundColor: THEME_COLOR,
    marginTop: 4,
    borderRadius: 2,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  lockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  companyBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A192F',
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#0A192F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  companyIconLargeBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FF6900',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyBannerPreTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  companyBannerMainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  companySystemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  companySystemBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
  },
  sectionHeaderWrap: {
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeadingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  menuCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuInfo: {
    flex: 1,
    marginRight: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  shiftCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  shiftCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6900',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 64,
  },
  lockActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
  },
  lockIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  lockCardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#991B1B',
    marginTop: 1,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  brandTaglineText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#CBD5E1',
    marginTop: 2,
  },

  // Modal backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContentSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A192F',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },

  // Shift Card
  shiftCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftCardActive: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFFBF8',
  },
  shiftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shiftCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
  },
  nightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  nightBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: NIGHT_COLOR,
    marginLeft: 4,
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shiftTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  shiftTimeCol: {
    alignItems: 'center',
  },
  shiftTimeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  shiftTimeValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  shiftTimeDividerV: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  shiftCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  shiftActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  shiftActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addShiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME_COLOR,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  addShiftBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME_COLOR,
  },

  // Form
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0A192F',
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  nightInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: NIGHT_COLOR_10,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  nightInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: NIGHT_COLOR,
    flex: 1,
    lineHeight: 16,
  },
  modalBodyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  shiftSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  shiftLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shiftTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  shiftSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  shiftTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLOR_10_OPACITY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 0, 0.25)',
  },
  shiftTimeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME_COLOR,
  },
  shiftDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  doneModalBtn: {
    backgroundColor: THEME_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 6,
  },
  doneModalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Alert Card (used by sync, pin, about)
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  planBadge: {
    backgroundColor: THEME_COLOR_10_OPACITY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME_COLOR,
    letterSpacing: 0.5,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A192F',
    marginBottom: 4,
    textAlign: 'center',
  },
  planSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  syncAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  syncStatsBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  syncStatCol: {
    alignItems: 'center',
  },
  syncStatVal: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME_COLOR,
  },
  syncStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  syncStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  pinDisplayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinDisplayText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: 2,
  },
  aboutAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  aboutDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
  },
  aboutVersion: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 18,
  },
  closeAlertBtn: {
    backgroundColor: THEME_COLOR,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  closeAlertBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});