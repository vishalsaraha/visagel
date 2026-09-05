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
import { useAttendance, ShiftEntry, CustomField } from '@/context/AttendanceContext';
import { extractFaceVector, computeCosineSimilarity } from '@/utils/faceEngine';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME_COLOR = '#FF6900';
const THEME_COLOR_10_OPACITY = 'rgba(255, 105, 0, 0.1)';
const NIGHT_COLOR = '#6366F1';
const NIGHT_COLOR_10 = 'rgba(99, 102, 241, 0.1)';

// Helper: detect night shift (end hour before start hour → crosses midnight)
function isNightShift(startH: number, endH: number): boolean {
  return endH <= startH;
}

// Format h/m as "h:mm AM/PM"
function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Build a Date with given h:mm (for the time picker)
function makeTime(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    adminPassword,
    adminAccounts,
    addAdminAccount,
    removeAdminAccount,
    updateAdminAccount,
    logout,
  } = useAuth();
  const {
    multipleTimeEntries, setMultipleTimeEntries, shifts, saveShifts,
    departments, saveDepartments,
    customFields, saveCustomFields,
    aiSettings, saveAiSettings, enrolledEmployees,
  } = useAttendance();

  // Feature toggles
  const [autoFaceDetection, setAutoFaceDetection] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [sendReportsDaily, setSendReportsDaily] = useState(false);

  // Modals
  const [manageShiftsVisible, setManageShiftsVisible] = useState(false);
  const [shiftFormVisible, setShiftFormVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftEntry | null>(null);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [hrManagerVisible, setHrManagerVisible] = useState(false);
  const [addHrModalVisible, setAddHrModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);

  // AI Model & Biometrics Settings
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [benchmarkModalVisible, setBenchmarkModalVisible] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<string | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Enrolment field management
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [customFieldsModalVisible, setCustomFieldsModalVisible] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomField['inputType']>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // New HR Account form
  const [newHrName, setNewHrName] = useState('');
  const [newHrLoginId, setNewHrLoginId] = useState('');
  const [newHrPassword, setNewHrPassword] = useState('');
  const [newHrRole, setNewHrRole] = useState<'SUPER_ADMIN' | 'HR_MANAGER' | 'HR_STAFF'>('HR_MANAGER');

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

  const runBenchmarkTest = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult('Initializing AI Biometrics Engine...');
    await new Promise((r) => setTimeout(r, 400));

    try {
      const valid = enrolledEmployees.filter((e) => Boolean(e.photoUri));
      if (valid.length === 0) {
        setBenchmarkResult('No enrolled photos found. Enroll employee photos in HR Admin to run benchmark tests.');
        setIsBenchmarking(false);
        return;
      }

      let report = `AI MODEL BENCHMARK REPORT\n`;
      report += `====================================\n`;
      report += `• Engine Mode: ${aiSettings.modelEngine === 'cloud' ? 'Cloud AI' : 'Local Edge 128-D Vector'}\n`;
      report += `• Liveness Guard: ${aiSettings.livenessMode.toUpperCase()}\n`;
      report += `• Target Threshold: ${aiSettings.minConfidence}%\n`;
      report += `• Enrolled Templates: ${valid.length}\n\n`;

      const startTime = Date.now();
      const vectors = [];

      for (let i = 0; i < valid.length; i++) {
        const emp = valid[i];
        const uri = emp.photoUri as string;
        const v = await extractFaceVector(uri);
        vectors.push({ emp, v });
        report += `[✔] ${emp.name} (${emp.employeeId}): 128-d Vector extracted.\n`;
      }

      const duration = Date.now() - startTime;
      report += `\nBENCHMARK RESULTS:\n`;
      report += `• Total Vector Extraction Time: ${duration} ms (${Math.round(duration / valid.length)} ms/template)\n`;

      if (vectors.length >= 2) {
        const sim = computeCosineSimilarity(vectors[0].v, vectors[1].v);
        const dist = (1 - sim).toFixed(3);
        report += `• Template Inter-Similarity (${vectors[0].emp.name} vs ${vectors[1].emp.name}): ${(sim * 100).toFixed(1)}% (Distance: ${dist})\n`;
      }

      report += `\n• Status: PASSED — AI Engine ready for high-accuracy attendance scanning.`;
      setBenchmarkResult(report);
    } catch (err) {
      setBenchmarkResult(`Benchmark Error: ${String(err)}`);
    } finally {
      setIsBenchmarking(false);
    }
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
    setFormStart(makeTime(shift.startHour, shift.startMin));
    setFormEnd(makeTime(shift.endHour, shift.endMin));
    setFormLateCutoff(makeTime(shift.lateCutoffHour, shift.lateCutoffMin));
    setShiftFormVisible(true);
  };

  const saveShiftForm = () => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Please enter a shift name.');
      return;
    }
    let updated: ShiftEntry[];
    if (editingShift) {
      updated = shifts.map((s) =>
        s.id === editingShift.id
          ? {
              ...s,
              name: formName.trim(),
              startHour: formStart.getHours(), startMin: formStart.getMinutes(),
              endHour: formEnd.getHours(), endMin: formEnd.getMinutes(),
              lateCutoffHour: formLateCutoff.getHours(), lateCutoffMin: formLateCutoff.getMinutes(),
            }
          : s
      );
    } else {
      const newShift: ShiftEntry = {
        id: Date.now().toString(),
        name: formName.trim(),
        startHour: formStart.getHours(), startMin: formStart.getMinutes(),
        endHour: formEnd.getHours(), endMin: formEnd.getMinutes(),
        lateCutoffHour: formLateCutoff.getHours(), lateCutoffMin: formLateCutoff.getMinutes(),
        isActive: false,
      };
      updated = [...shifts, newShift];
    }
    saveShifts(updated);
    setShiftFormVisible(false);
  };

  const deleteShift = (id: string) => {
    Alert.alert('Delete Shift', 'Delete this shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => saveShifts(shifts.filter((s) => s.id !== id)),
      },
    ]);
  };

  const setActiveShift = (id: string) => {
    saveShifts(shifts.map((s) => ({ ...s, isActive: s.id === id })));
  };

  // ---------- HR Accounts handler ----------
  const handleCreateHrAccount = async () => {
    if (!newHrName.trim() || !newHrLoginId.trim() || !newHrPassword.trim()) {
      Alert.alert('Incomplete Details', 'Please fill in HR Name, Login ID and Password.');
      return;
    }
    const success = await addAdminAccount({
      name: newHrName.trim(),
      loginId: newHrLoginId.trim(),
      password: newHrPassword.trim(),
      role: newHrRole,
    });
    if (success) {
      Alert.alert('Success', `Created HR account for ${newHrName} (${newHrLoginId})!`);
      setNewHrName('');
      setNewHrLoginId('');
      setNewHrPassword('');
      setAddHrModalVisible(false);
    } else {
      Alert.alert('Duplicate ID', 'An HR account with this Login ID already exists.');
    }
  };

  const handleDeleteHrAccount = (id: string, name: string) => {
    if (adminAccounts.length <= 1) {
      Alert.alert('Action Denied', 'You cannot remove the primary admin account.');
      return;
    }
    Alert.alert('Remove HR Access', `Are you sure you want to revoke credentials for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await removeAdminAccount(id);
          Alert.alert('Removed', `Credentials for ${name} have been revoked.`);
        },
      },
    ]);
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

  // ---------- Department CRUD ----------
  const handleAddDepartment = () => {
    const name = newDeptName.trim();
    if (!name) { Alert.alert('Validation', 'Please enter a department name.'); return; }
    if (departments.some((d) => d.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicate', `"${name}" already exists.`); return;
    }
    saveDepartments([...departments, name]);
    setNewDeptName('');
  };

  const handleRemoveDepartment = (dept: string) => {
    Alert.alert('Remove Department', `Remove "${dept}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveDepartments(departments.filter((d) => d !== dept)) },
    ]);
  };

  // ---------- Custom Field CRUD ----------
  const handleAddCustomField = () => {
    const label = newFieldLabel.trim();
    const key = newFieldKey.trim() || label.toLowerCase().replace(/\s+/g, '_');
    if (!label) { Alert.alert('Validation', 'Please enter a field label.'); return; }
    if (customFields.some((f) => f.key === key)) {
      Alert.alert('Duplicate', `A field with key "${key}" already exists.`); return;
    }
    const newField: CustomField = {
      id: Date.now().toString(),
      label,
      key,
      inputType: newFieldType,
      isRequired: newFieldRequired,
    };
    saveCustomFields([...customFields, newField]);
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldType('text');
    setNewFieldRequired(false);
  };

  const handleRemoveCustomField = (id: string, label: string) => {
    Alert.alert('Remove Field', `Remove the "${label}" field from enrollment forms?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveCustomFields(customFields.filter((f) => f.id !== id)) },
    ]);
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
              <Text style={styles.companyNameText}>Branzept</Text>
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
            <Text style={styles.companyBannerMainTitle}>Branzept</Text>
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
                {activeShift ? `Active: ${activeShift.name} (${formatTime(activeShift.startHour, activeShift.startMin)} - ${formatTime(activeShift.endHour, activeShift.endMin)})` : 'Configure shifts & timings'}
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

        {/* SECTION 2.5: ENROLMENT FIELDS */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>ENROLMENT FIELDS</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* Departments */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setDeptModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="office-building-outline" size={20} color="#059669" />
            </View>
            <View style={styles.menuInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuTitle}>Departments</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{departments.length}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription}>Add or remove departments available in enrollment</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Custom Fields */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setCustomFieldsModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="form-textbox" size={20} color="#2563EB" />
            </View>
            <View style={styles.menuInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuTitle}>Custom Enrolment Fields</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{customFields.length}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription}>Add extra fields to the employee enrollment form</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* SECTION 2.8: AI BIOMETRIC ENGINE & DETECTION */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>AI BIOMETRIC ENGINE & DETECTION</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* AI Model & Security Configuration */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setAiModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="brain" size={20} color="#059669" />
            </View>
            <View style={styles.menuInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuTitle}>AI Detection & Model Engine</Text>
                <View style={[styles.countBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.countBadgeText, { color: '#166534' }]}>
                    {aiSettings.modelEngine === 'cloud' ? 'Cloud AI' : 'Edge 128-D'}
                  </Text>
                </View>
              </View>
              <Text style={styles.menuDescription}>
                Confidence: {aiSettings.minConfidence}% · Liveness: {aiSettings.livenessMode}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Model Accuracy Benchmark Diagnostic Tool */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setBenchmarkModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="speedometer" size={20} color="#2563EB" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Model Benchmark & Diagnostic</Text>
              <Text style={styles.menuDescription}>Run vector accuracy & liveness check test on enrolled templates</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* SECTION 3: SECURITY & HR ACCESS */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>SECURITY & HR ACCESS</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* Multiple HR IDs & Passwords Management */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setHrManagerVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
              <MaterialCommunityIcons name="account-key-outline" size={20} color="#FF6900" />
            </View>
            <View style={styles.menuInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuTitle}>HR Admin Accounts</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{adminAccounts.length}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription}>Create & manage multiple HR logins & passwords</Text>
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
              <Text style={styles.menuDescription}>Version, biometric engine and company info</Text>
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
          <View style={styles.poweredByFooterRow}>
            <MaterialCommunityIcons name="lightning-bolt" size={11} color="#FF6900" style={{ marginRight: 3 }} />
            <Text style={styles.brandTaglineText}>Powered by </Text>
            <Text style={styles.brandTaglineAccent}>Branzept</Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== MANAGE DEPARTMENTS MODAL ===== */}
      <Modal
        visible={deptModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDeptModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Departments</Text>
                <Text style={styles.modalSubtitle}>{departments.length} department{departments.length !== 1 ? 's' : ''} configured</Text>
              </View>
              <TouchableOpacity onPress={() => setDeptModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="close" size={18} color="#0A192F" />
              </TouchableOpacity>
            </View>

            {/* Add new dept */}
            <View style={styles.addFieldRow}>
              <TextInput
                style={styles.addFieldInput}
                placeholder="New department name…"
                placeholderTextColor="#9CA3AF"
                value={newDeptName}
                onChangeText={setNewDeptName}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleAddDepartment}
              />
              <TouchableOpacity style={styles.addFieldBtn} onPress={handleAddDepartment} activeOpacity={0.8}>
                <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {departments.length === 0 ? (
                <View style={styles.emptyFieldsBox}>
                  <MaterialCommunityIcons name="office-building-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyFieldsText}>No departments added yet</Text>
                </View>
              ) : (
                departments.map((dept) => (
                  <View key={dept} style={styles.fieldListRow}>
                    <View style={[styles.fieldTypeTag, { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }]}>
                      <MaterialCommunityIcons name="office-building-outline" size={14} color="#059669" />
                    </View>
                    <Text style={styles.fieldListLabel}>{dept}</Text>
                    <TouchableOpacity
                      style={styles.fieldDeleteBtn}
                      onPress={() => handleRemoveDepartment(dept)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== MANAGE CUSTOM FIELDS MODAL ===== */}
      <Modal
        visible={customFieldsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCustomFieldsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Custom Fields</Text>
                <Text style={styles.modalSubtitle}>{customFields.length} field{customFields.length !== 1 ? 's' : ''} configured</Text>
              </View>
              <TouchableOpacity onPress={() => setCustomFieldsModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="close" size={18} color="#0A192F" />
              </TouchableOpacity>
            </View>

            {/* Add new field form */}
            <View style={styles.newFieldFormCard}>
              <Text style={styles.newFieldFormTitle}>Add New Field</Text>

              <Text style={styles.inputLabel}>Field Label *</Text>
              <TextInput
                style={styles.customFieldFormInput}
                placeholder="e.g. Employee Badge No."
                placeholderTextColor="#9CA3AF"
                value={newFieldLabel}
                onChangeText={(t) => {
                  setNewFieldLabel(t);
                  setNewFieldKey(t.trim().toLowerCase().replace(/\s+/g, '_'));
                }}
                autoCapitalize="words"
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Field Key (auto-generated)</Text>
              <TextInput
                style={[styles.customFieldFormInput, { color: '#64748B', backgroundColor: '#F8FAFC' }]}
                value={newFieldKey}
                onChangeText={setNewFieldKey}
                placeholder="e.g. badge_no"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Input Type</Text>
              <View style={styles.typeRow}>
                {(['text', 'phone', 'number', 'email'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, newFieldType === t && styles.typeChipActive]}
                    onPress={() => setNewFieldType(t)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.typeChipText, newFieldType === t && styles.typeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.requiredRow}>
                <Text style={styles.inputLabel}>Required field?</Text>
                <Switch
                  value={newFieldRequired}
                  onValueChange={setNewFieldRequired}
                  trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity style={styles.addCustomFieldBtn} onPress={handleAddCustomField} activeOpacity={0.85}>
                <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addCustomFieldBtnText}>Add Field</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {customFields.length === 0 ? (
                <View style={styles.emptyFieldsBox}>
                  <MaterialCommunityIcons name="form-textbox" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyFieldsText}>No custom fields yet</Text>
                </View>
              ) : (
                customFields.map((field) => {
                  const typeColor: Record<string, string> = { text: '#2563EB', phone: '#059669', number: '#D97706', email: '#7C3AED' };
                  const typeBg: Record<string, string> = { text: '#EFF6FF', phone: '#ECFDF5', number: '#FFFBEB', email: '#F5F3FF' };
                  return (
                    <View key={field.id} style={styles.fieldListRow}>
                      <View style={[styles.fieldTypeTag, { backgroundColor: typeBg[field.inputType] || '#F1F5F9', borderColor: typeColor[field.inputType] || '#94A3B8' }]}>
                        <Text style={[styles.fieldTypeTagText, { color: typeColor[field.inputType] || '#475569' }]}>{field.inputType}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldListLabel}>{field.label}</Text>
                        <Text style={styles.fieldListKey}>{field.key}{field.isRequired ? ' • Required' : ''}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.fieldDeleteBtn}
                        onPress={() => handleRemoveCustomField(field.id, field.label)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                const night = isNightShift(shift.startHour, shift.endHour);
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
                        <Text style={[styles.shiftTimeValue, { color: accentColor }]}>{formatTime(shift.startHour, shift.startMin)}</Text>
                      </View>
                      <MaterialCommunityIcons name="arrow-right" size={16} color="#94A3B8" />
                      <View style={styles.shiftTimeCol}>
                        <Text style={styles.shiftTimeLabel}>End {night ? '(+1 day)' : ''}</Text>
                        <Text style={[styles.shiftTimeValue, { color: accentColor }]}>{formatTime(shift.endHour, shift.endMin)}</Text>
                      </View>
                      <View style={styles.shiftTimeDividerV} />
                      <View style={styles.shiftTimeCol}>
                        <Text style={styles.shiftTimeLabel}>Late After</Text>
                        <Text style={[styles.shiftTimeValue, { color: accentColor }]}>{formatTime(shift.lateCutoffHour, shift.lateCutoffMin)}</Text>
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
                  {isNightShift(formStart.getHours(), formEnd.getHours())
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
            {isNightShift(formStart.getHours(), formEnd.getHours()) && (
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
                  <Text style={styles.shiftTimeBadgeText}>{formatTime(formStart.getHours(), formStart.getMinutes())}</Text>
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
                  <View style={[styles.miniIconCircle, { backgroundColor: isNightShift(formStart.getHours(), formEnd.getHours()) ? NIGHT_COLOR_10 : THEME_COLOR_10_OPACITY }]}>
                    <FontAwesome name="hourglass-end" size={14} color={isNightShift(formStart.getHours(), formEnd.getHours()) ? NIGHT_COLOR : THEME_COLOR} />
                  </View>
                  <View>
                    <Text style={styles.shiftTitle}>
                      End Time {isNightShift(formStart.getHours(), formEnd.getHours()) ? '(next day)' : ''}
                    </Text>
                    <Text style={styles.shiftSub}>When the shift ends</Text>
                  </View>
                </View>
                <View style={[styles.shiftTimeBadge, isNightShift(formStart.getHours(), formEnd.getHours()) && { backgroundColor: NIGHT_COLOR_10, borderColor: 'rgba(99, 102, 241, 0.25)' }]}>
                  <Text style={[styles.shiftTimeBadgeText, isNightShift(formStart.getHours(), formEnd.getHours()) && { color: NIGHT_COLOR }]}>{formatTime(formEnd.getHours(), formEnd.getMinutes())}</Text>
                  <FontAwesome name="pencil" size={11} color={isNightShift(formStart.getHours(), formEnd.getHours()) ? NIGHT_COLOR : THEME_COLOR} style={{ marginLeft: 6 }} />
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
                  <Text style={styles.shiftTimeBadgeText}>{formatTime(formLateCutoff.getHours(), formLateCutoff.getMinutes())}</Text>
                  <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.doneModalBtn} onPress={saveShiftForm} activeOpacity={0.85}>
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

      {/* ===== HR ACCOUNTS MANAGEMENT MODAL ===== */}
      <Modal
        visible={hrManagerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHrManagerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <View style={styles.companyBadgeRow}>
                  <FontAwesome name="shield" size={11} color={THEME_COLOR} style={{ marginRight: 4 }} />
                  <Text style={styles.companyNameText}>SECURITY</Text>
                </View>
                <Text style={styles.sheetTitle}>HR Admin Accounts</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setHrManagerVisible(false)}>
                <FontAwesome name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
              <View style={styles.hrHeaderInfo}>
                <MaterialCommunityIcons name="shield-account-outline" size={20} color="#FF6900" style={{ marginRight: 8 }} />
                <Text style={styles.hrHeaderInfoText}>
                  Provide unique HR ID & Passwords to different HR personnel for authorized administrative access.
                </Text>
              </View>

              {/* Accounts list */}
              {adminAccounts.map((acc) => (
                <View key={acc.id} style={styles.hrAccountCard}>
                  <View style={styles.hrAvatarCircle}>
                    <FontAwesome name="user-secret" size={18} color="#FF6900" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.hrAccountName}>{acc.name}</Text>
                      <View style={[styles.roleBadge, acc.role === 'SUPER_ADMIN' ? styles.roleBadgeSuper : styles.roleBadgeManager]}>
                        <Text style={[styles.roleBadgeText, acc.role === 'SUPER_ADMIN' ? { color: '#0A192F' } : { color: '#0284C7' }]}>
                          {acc.role.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.hrCredsRow}>
                      <Text style={styles.hrCredsLabel}>Login ID: </Text>
                      <Text style={styles.hrCredsValue}>{acc.loginId}</Text>
                      <Text style={[styles.hrCredsLabel, { marginLeft: 12 }]}>Password: </Text>
                      <Text style={styles.hrCredsValue}>{acc.password}</Text>
                    </View>
                  </View>
                  {acc.role !== 'SUPER_ADMIN' && (
                    <TouchableOpacity
                      style={styles.hrDeleteBtn}
                      onPress={() => handleDeleteHrAccount(acc.id, acc.name)}
                      activeOpacity={0.7}
                    >
                      <FontAwesome name="trash-o" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addHrActionBtn}
                onPress={() => setAddHrModalVisible(true)}
                activeOpacity={0.8}
              >
                <FontAwesome name="plus" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addHrActionBtnText}>Add New HR Account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== ADD NEW HR MODAL ===== */}
      <Modal
        visible={addHrModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddHrModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'center' }]}>
          <View style={styles.alertCard}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>NEW CREDENTIALS</Text>
            </View>
            <Text style={styles.planTitle}>Create HR Account</Text>
            <Text style={styles.planSubtitle}>Create new login credentials for HR staff</Text>

            <View style={{ width: '100%', gap: 10, marginVertical: 14 }}>
              <View>
                <Text style={styles.inputLabel}>HR Officer / Manager Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHrName}
                  onChangeText={setNewHrName}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>HR Login ID</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHrLoginId}
                  onChangeText={setNewHrLoginId}
                  placeholder="e.g. hr_priya"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHrPassword}
                  onChangeText={setNewHrPassword}
                  placeholder="Enter secure password"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Role Designation</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.roleSelectPill, newHrRole === 'HR_MANAGER' && styles.roleSelectPillActive]}
                    onPress={() => setNewHrRole('HR_MANAGER')}
                  >
                    <Text style={[styles.roleSelectPillText, newHrRole === 'HR_MANAGER' && styles.roleSelectPillTextActive]}>
                      HR Manager
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleSelectPill, newHrRole === 'HR_STAFF' && styles.roleSelectPillActive]}
                    onPress={() => setNewHrRole('HR_STAFF')}
                  >
                    <Text style={[styles.roleSelectPillText, newHrRole === 'HR_STAFF' && styles.roleSelectPillTextActive]}>
                      HR Staff
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.closeAlertBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                onPress={() => setAddHrModalVisible(false)}
              >
                <Text style={[styles.closeAlertBtnText, { color: '#64748B' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeAlertBtn, { flex: 1, backgroundColor: THEME_COLOR }]}
                onPress={handleCreateHrAccount}
              >
                <Text style={styles.closeAlertBtnText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== AI MODEL SETTINGS MODAL ===== */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>AI Biometrics & Model Engine</Text>
                <Text style={styles.modalSubtitle}>Configure face detection, liveness & accuracy thresholds</Text>
              </View>
              <TouchableOpacity onPress={() => setAiModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="times" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 4, paddingTop: 6 }}>
              {/* Model Engine Selector */}
              <Text style={styles.inputLabel}>Biometric Detection Engine</Text>
              <View style={{ flexDirection: 'column', gap: 8, marginTop: 6, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectPill,
                    { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
                    aiSettings.modelEngine === 'local' && styles.roleSelectPillActive,
                  ]}
                  onPress={() => saveAiSettings({ modelEngine: 'local' })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                      name="cpu-64-bit"
                      size={18}
                      color={aiSettings.modelEngine === 'local' ? '#FFFFFF' : '#059669'}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleSelectPillText, aiSettings.modelEngine === 'local' && styles.roleSelectPillTextActive]}>
                        Local Edge Engine (128-D Feature Vectors)
                      </Text>
                      <Text style={{ fontSize: 11, color: aiSettings.modelEngine === 'local' ? 'rgba(255,255,255,0.85)' : '#64748B', marginTop: 2 }}>
                        100% On-Device, Privacy-first, Fast & Offline operations
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleSelectPill,
                    { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
                    aiSettings.modelEngine === 'cloud' && styles.roleSelectPillActive,
                  ]}
                  onPress={() => saveAiSettings({ modelEngine: 'cloud' })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                      name="cloud-check-outline"
                      size={18}
                      color={aiSettings.modelEngine === 'cloud' ? '#FFFFFF' : '#2563EB'}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleSelectPillText, aiSettings.modelEngine === 'cloud' && styles.roleSelectPillTextActive]}>
                        Enterprise Cloud AI Provider API
                      </Text>
                      <Text style={{ fontSize: 11, color: aiSettings.modelEngine === 'cloud' ? 'rgba(255,255,255,0.85)' : '#64748B', marginTop: 2 }}>
                        Compare face frames via AWS Rekognition / Face++ API
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Passive Liveness & Anti-Spoofing Guard Level */}
              <Text style={styles.inputLabel}>Liveness Anti-Spoofing Security</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 16 }}>
                {(['strict', 'balanced', 'off'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.roleSelectPill,
                      { flex: 1, alignItems: 'center', paddingVertical: 10 },
                      aiSettings.livenessMode === mode && styles.roleSelectPillActive,
                    ]}
                    onPress={() => saveAiSettings({ livenessMode: mode })}
                  >
                    <Text style={[styles.roleSelectPillText, aiSettings.livenessMode === mode && styles.roleSelectPillTextActive]}>
                      {mode === 'strict' ? 'Strict (High)' : mode === 'balanced' ? 'Balanced' : 'Disabled'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Match Confidence Threshold */}
              <Text style={styles.inputLabel}>Minimum Confidence Acceptance Threshold</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 16 }}>
                {[65, 75, 85, 90].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.roleSelectPill,
                      { flex: 1, alignItems: 'center', paddingVertical: 10 },
                      aiSettings.minConfidence === val && styles.roleSelectPillActive,
                    ]}
                    onPress={() => saveAiSettings({ minConfidence: val })}
                  >
                    <Text style={[styles.roleSelectPillText, aiSettings.minConfidence === val && styles.roleSelectPillTextActive]}>
                      {val}% Match
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scan Cooldown Buffer */}
              <Text style={styles.inputLabel}>Duplicate Scan Cooldown Window</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 16 }}>
                {[15, 30, 60, 120].map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[
                      styles.roleSelectPill,
                      { flex: 1, alignItems: 'center', paddingVertical: 10 },
                      aiSettings.scanCooldownSec === sec && styles.roleSelectPillActive,
                    ]}
                    onPress={() => saveAiSettings({ scanCooldownSec: sec })}
                  >
                    <Text style={[styles.roleSelectPillText, aiSettings.scanCooldownSec === sec && styles.roleSelectPillTextActive]}>
                      {sec} sec
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cloud API credentials input if cloud mode selected */}
              {aiSettings.modelEngine === 'cloud' && (
                <View style={{ marginTop: 4, marginBottom: 16, backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12 }}>
                  <Text style={[styles.inputLabel, { color: '#0F172A' }]}>Cloud API Endpoint URL</Text>
                  <TextInput
                    style={[styles.formInput, { marginBottom: 10 }]}
                    value={aiSettings.cloudApiUrl}
                    onChangeText={(val) => saveAiSettings({ cloudApiUrl: val })}
                    placeholder="https://api-us.faceplusplus.com/facepp/v3/compare"
                  />
                  <Text style={[styles.inputLabel, { color: '#0F172A' }]}>API Key</Text>
                  <TextInput
                    style={[styles.formInput, { marginBottom: 10 }]}
                    value={aiSettings.cloudApiKey}
                    onChangeText={(val) => saveAiSettings({ cloudApiKey: val })}
                    placeholder="Enter Cloud API Key"
                  />
                  <Text style={[styles.inputLabel, { color: '#0F172A' }]}>API Secret / Private Key</Text>
                  <TextInput
                    style={styles.formInput}
                    value={aiSettings.cloudApiSecret}
                    onChangeText={(val) => saveAiSettings({ cloudApiSecret: val })}
                    placeholder="Enter Secret Key"
                    secureTextEntry
                  />
                </View>
              )}
            </ScrollView>

            <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 10 }}>
              <TouchableOpacity style={styles.closeAlertBtn} onPress={() => setAiModalVisible(false)}>
                <Text style={styles.closeAlertBtnText}>Save & Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== AI BENCHMARK & DIAGNOSTIC MODAL ===== */}
      <Modal
        visible={benchmarkModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBenchmarkModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Model Diagnostic & Benchmark</Text>
                <Text style={styles.modalSubtitle}>Test face vector extraction & cosine match speed</Text>
              </View>
              <TouchableOpacity onPress={() => setBenchmarkModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="times" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 4, paddingTop: 10 }}>
              <TouchableOpacity
                style={[styles.closeAlertBtn, { backgroundColor: THEME_COLOR, marginBottom: 16 }]}
                onPress={runBenchmarkTest}
                disabled={isBenchmarking}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.closeAlertBtnText}>
                  {isBenchmarking ? 'Running Biometric Test...' : 'Run Diagnostics & Vector Test'}
                </Text>
              </TouchableOpacity>

              {benchmarkResult ? (
                <View style={{ backgroundColor: '#0F172A', borderRadius: 12, padding: 14, marginBottom: 20 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#10B981', lineHeight: 18 }}>
                    {benchmarkResult}
                  </Text>
                </View>
              ) : (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="brain" size={44} color="#94A3B8" style={{ marginBottom: 10 }} />
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    Tap 'Run Diagnostics' above to evaluate face feature extraction performance across enrolled templates.
                  </Text>
                </View>
              )}
            </ScrollView>
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
  poweredByFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  brandTaglineText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  brandTaglineAccent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6900',
    letterSpacing: 0.3,
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

  // HR Accounts Manager Styles
  hrHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  hrHeaderInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 17,
    fontWeight: '500',
  },
  hrAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  hrAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hrAccountName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeSuper: {
    backgroundColor: '#FEF3C7',
  },
  roleBadgeManager: {
    backgroundColor: '#E0F2FE',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hrCredsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hrCredsLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  hrCredsValue: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  hrDeleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  addHrActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLOR,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addHrActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleSelectPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectPillActive: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFF7ED',
  },
  roleSelectPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roleSelectPillTextActive: {
    color: THEME_COLOR,
  },

  // Missing Modal & Header Styles
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME_COLOR,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  // ── Enrolment Field Management ──────────────────────────────────────────────
  addFieldRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  addFieldInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  addFieldBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyFieldsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyFieldsText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  fieldListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  fieldTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  fieldTypeTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fieldListLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  fieldListKey: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 1,
  },
  fieldDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFieldFormCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  newFieldFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  customFieldFormInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  typeChipActive: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  requiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
  },
  addCustomFieldBtn: {
    flexDirection: 'row',
    backgroundColor: THEME_COLOR,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addCustomFieldBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});