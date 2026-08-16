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
  // Feature toggles
  const [multipleTimeEntries, setMultipleTimeEntries] = useState(false);
  const [autoFaceDetection, setAutoFaceDetection] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [sendReportsDaily, setSendReportsDaily] = useState(false);

  // Shift list
  const [shifts, setShifts] = useState<ShiftEntry[]>(DEFAULT_SHIFTS);

  // Modals
  const [manageShiftsVisible, setManageShiftsVisible] = useState(false);
  const [shiftFormVisible, setShiftFormVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftEntry | null>(null);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [adminPin, setAdminPin] = useState('1234');

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerUnderline} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.listContainer}>
          {/* Manage Shifts */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => setManageShiftsVisible(true)}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="history" size={20} color={THEME_COLOR} />
              </View>
              <View>
                <Text style={styles.menuTitleText}>Manage Shifts</Text>
                {activeShift && (
                  <Text style={styles.menuSubText}>
                    Active: {activeShift.name}
                    {isNightShift(activeShift.startTime, activeShift.endTime) ? '  🌙' : '  ☀️'}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.shiftCountBadge}>
              <Text style={styles.shiftCountText}>{shifts.length}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Multiple Time Entries */}
          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="clock-time-four-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Multiple Time Entries</Text>
            </View>
            <Switch
              value={multipleTimeEntries}
              onValueChange={setMultipleTimeEntries}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Auto Face Detection */}
          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="face-recognition" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Auto Face Detection</Text>
            </View>
            <Switch
              value={autoFaceDetection}
              onValueChange={setAutoFaceDetection}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Voice Scan Feedback */}
          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="volume-high" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Voice Scan Feedback</Text>
            </View>
            <Switch
              value={voiceFeedback}
              onValueChange={setVoiceFeedback}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Send reports daily */}
          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="email-check-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Send reports daily</Text>
            </View>
            <Switch
              value={sendReportsDaily}
              onValueChange={setSendReportsDaily}
              trackColor={{ false: '#E5E7EB', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Sync Attendance Records */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => setSyncModalVisible(true)}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="cloud-sync-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Sync Attendance Records</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Admin PIN */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => setPinModalVisible(true)}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Admin PIN</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Help */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={handleHelp}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="help-circle-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Help</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* About Us */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => setAboutModalVisible(true)}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="information-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>About Us</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Rate us */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={handleRateUs}>
            <View style={styles.menuRowLeft}>
              <View style={styles.iconCircleWrapper}>
                <MaterialCommunityIcons name="star-outline" size={20} color={THEME_COLOR} />
              </View>
              <Text style={styles.menuTitleText}>Rate us on Google Play</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <View style={styles.footerOrangeLine} />
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <View style={styles.footerBrandRow}>
            <FontAwesome name="building" size={12} color={THEME_COLOR} style={{ marginRight: 6 }} />
            <Text style={styles.brandSubtitleText}>Branzept</Text>
            <Text style={styles.brandDotSeparator}> • </Text>
            <Text style={styles.brandSubtitleText}>Visagel</Text>
          </View>
          <Text style={styles.brandTaglineText}>Smart Face Attendance System</Text>
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

      {/* ===== PIN MODAL ===== */}
      <Modal
        visible={pinModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'center' }]}>
          <View style={styles.alertCard}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>SECURITY</Text>
            </View>
            <Text style={styles.planTitle}>Admin Kiosk PIN</Text>
            <Text style={styles.planSubtitle}>Current default PIN for Admin Kiosk unlock is active.</Text>
            <View style={styles.pinDisplayBox}>
              <Text style={styles.pinDisplayText}>•••• ({adminPin})</Text>
            </View>
            <TouchableOpacity
              style={[styles.closeAlertBtn, { backgroundColor: '#F1F5F9', marginBottom: 10 }]}
              onPress={() => {
                if (Alert.prompt) {
                  Alert.prompt('Set New Admin PIN', 'Enter 4-digit security PIN:', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Save',
                      onPress: (newPin?: string) => {
                        if (newPin && newPin.length === 4) {
                          setAdminPin(newPin);
                          Alert.alert('PIN Updated', 'New Admin PIN saved successfully.');
                        }
                      },
                    },
                  ]);
                } else {
                  Alert.alert('Admin PIN', `Current Admin Kiosk PIN is ${adminPin}`);
                }
              }}
            >
              <Text style={[styles.closeAlertBtnText, { color: '#0A192F' }]}>Change PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeAlertBtn} onPress={() => setPinModalVisible(false)}>
              <Text style={styles.closeAlertBtnText}>Done</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
  },
  headerUnderline: {
    width: 38,
    height: 3.5,
    backgroundColor: THEME_COLOR,
    marginTop: 6,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listContainer: {
    backgroundColor: '#FFFFFF',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircleWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME_COLOR_10_OPACITY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.1,
  },
  menuSubText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  shiftCountBadge: {
    backgroundColor: THEME_COLOR_10_OPACITY,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 0, 0.25)',
    marginLeft: 8,
  },
  shiftCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME_COLOR,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 24,
    paddingTop: 20,
  },
  footerOrangeLine: {
    width: 40,
    height: 3,
    backgroundColor: THEME_COLOR,
    borderRadius: 2,
    marginBottom: 12,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  brandSubtitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: 0.5,
  },
  brandDotSeparator: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME_COLOR,
  },
  brandTaglineText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: 0.2,
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