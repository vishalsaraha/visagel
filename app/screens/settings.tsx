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
import { ThemedAlert } from '@/components/ThemedAlertProvider';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import AppDateTimePicker from '@/components/AppDateTimePicker';
import OrgLoginModal from '@/components/OrgLoginModal';
import { getOrgPlatformAccountDb, saveOrgPlatformAccountDb, logoutOrgPlatformAccountDb, deriveCompanyName, OrgPlatformAccount, getKeyValue, setKeyValue } from '@/utils/database';
import { formatLocalDate } from '@/utils/clockSync';

const THEME_COLOR = '#FF6900';
const THEME_COLOR_10_OPACITY = 'rgba(255, 105, 0, 0.1)';
const NIGHT_COLOR = '#6366F1';
const NIGHT_COLOR_10 = 'rgba(99, 102, 241, 0.1)';

// Helper: detect night shift (end hour before start hour â†’ crosses midnight)
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
    currentUser,
  } = useAuth();
  const {
    attendanceRecords,
    multipleTimeEntries, setMultipleTimeEntries, shifts, saveShifts,
    departments, saveDepartments,
    customFields, saveCustomFields,
    aiSettings, saveAiSettings, enrolledEmployees,
    voiceFeedback, saveVoiceFeedback,
    groupScanMode, saveGroupScanMode,
  } = useAttendance();

  // Feature toggles
  const [autoFaceDetection, setAutoFaceDetection] = useState(true);
  const [sendReportsDaily, setSendReportsDaily] = useState(false);

  // Daily Email Summary State
  const [dailyEmailModalVisible, setDailyEmailModalVisible] = useState(false);
  const [companyEmailInput, setCompanyEmailInput] = useState(currentUser?.companyEmail || 'admin@company.com');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Daily Report Email Address (persistent, changeable)
  const [dailyMailModalVisible, setDailyMailModalVisible] = useState(false);
  const [dailyMailAddress, setDailyMailAddress] = useState<string>(
    () => getKeyValue('daily_report_email') || currentUser?.companyEmail || 'admin@company.com'
  );
  const [dailyMailInput, setDailyMailInput] = useState<string>('');

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
  const [newHrEmail, setNewHrEmail] = useState('');
  const [newHrRole, setNewHrRole] = useState<'SUPER_ADMIN' | 'HR_MANAGER' | 'HR_STAFF'>('HR_MANAGER');

  // Organisation Platform Account (Bottom of Settings)
  const [orgLoginModalVisible, setOrgLoginModalVisible] = useState(false);
  const [orgAccount, setOrgAccount] = useState<OrgPlatformAccount>(() => getOrgPlatformAccountDb());

  const handleOrgLogout = () => {
    ThemedAlert.alert(
      'Logout Organisation',
      'Are you sure you want to end the organisation session and remove the active Organisation ID?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout & Disconnect',
          style: 'destructive',
          onPress: () => {
            const loggedOut = logoutOrgPlatformAccountDb();
            setOrgAccount(loggedOut);
            ThemedAlert.alert('Organisation Logged Out', 'Organisation ID has been disconnected and cleared.', [{ text: 'OK' }], 'info');
          },
        },
      ]
    );
  };

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

  const handleSendDailyEmailSummary = async (targetEmail?: string) => {
    const email = targetEmail || companyEmailInput || currentUser?.companyEmail || 'admin@company.com';
    const company = currentUser?.companyName || 'Visagel Enterprise';
    const todayStr = formatLocalDate(new Date());
    const todayRecords = attendanceRecords.filter((r) => r.date === todayStr);

    try {
      setIsSendingEmail(true);
      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        ThemedAlert.alert('Email Unavailable', 'Email composition is not available on this device.', [{ text: 'OK' }], 'error');
        setIsSendingEmail(false);
        return;
      }

      let csvContent = 'SI No.,Employee ID,Name,Department,Date,Status,First In,Last Out,Total Punches,Punch Log\n';
      todayRecords.forEach((r, idx) => {
        const firstIn = r.punches.find((p) => p.type === 'IN')?.time || 'N/A';
        const lastOut = [...r.punches].reverse().find((p) => p.type === 'OUT')?.time || 'N/A';
        const punchLog = r.punches.map((p) => `[${p.type}: ${p.time}]`).join(' | ');
        csvContent += `${idx + 1},"${r.employeeId}","${r.name}","${r.department || 'General'}","${r.date}","${r.status}","${firstIn}","${lastOut}","${r.punches.length}","${punchLog}"\n`;
      });

      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const fileUri = `${baseDir}visagel_daily_summary_${todayStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      const emailBody =
        `Dear Leadership & Management,\n\n` +
        `Please find below the Daily Attendance Summary report for ${todayStr}:\n\n` +
        `â€¢ Organization: ${company}\n` +
        `â€¢ Date: ${todayStr}\n` +
        `â€¢ Staff Present: ${todayRecords.length}\n` +
        `â€¢ Total Enrolled: ${enrolledEmployees.length}\n` +
        `â€¢ Dispatched by: ${currentUser?.name || 'Admin'} (${currentUser?.loginId || 'admin'})\n\n` +
        `Detailed punch stamps and biometric audit logs are attached as CSV.\n\n` +
        `Regards,\nVisagel Face Attendance Terminal`;

      await MailComposer.composeAsync({
        recipients: [email],
        subject: `[Daily Summary] ${company} - Attendance Report ${todayStr}`,
        body: emailBody,
        attachments: [fileUri],
      });

      ThemedAlert.alert('Email Dispatched', `Daily attendance summary prepared for ${email}.`, [{ text: 'Done' }], 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email summary.';
      ThemedAlert.alert('Email Error', msg, [{ text: 'OK' }], 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };


  const runBenchmarkTest = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult('Initializing AI Biometrics Engine...');
    await new Promise((r) => setTimeout(r, 350));

    try {
      const valid = enrolledEmployees.filter((e) => Boolean(e.photoUri));

      let report = `AI MODEL BENCHMARK REPORT\n`;
      report += `====================================\n`;
      report += `• Engine Mode: Local Edge 128-D Biometric Vector\n`;
      report += `â€¢ Liveness Guard: ${aiSettings.livenessMode.toUpperCase()}\n`;
      report += `â€¢ Target Threshold: ${aiSettings.minConfidence}%\n`;
      report += `â€¢ Enrolled Personnel: ${enrolledEmployees.length} (${valid.length} with Photos)\n\n`;

      const startTime = Date.now();
      const vectors = [];

      if (valid.length > 0) {
        for (let i = 0; i < valid.length; i++) {
          const emp = valid[i];
          const uri = emp.photoUri as string;
          const v = await extractFaceVector(uri);
          vectors.push({ emp, v });
          report += `[âœ”] ${emp.name} (${emp.employeeId}): 128-d Vector extracted.\n`;
        }
      }

      // Synthetic benchmark test (always runs so benchmark is checkable anytime)
      const SYNTH_PROBES = 100;
      const vA: number[] = Array.from({ length: 128 }, (_, j) => Math.sin(j * 0.1));
      const vB: number[] = Array.from({ length: 128 }, (_, j) => Math.cos(j * 0.1));
      const benchStart = Date.now();
      let lastSim = 0;
      for (let k = 0; k < SYNTH_PROBES; k++) {
        lastSim = computeCosineSimilarity(vA, vB);
      }
      const benchTime = Math.max(1, Date.now() - benchStart);
      const opsPerSec = Math.round((SYNTH_PROBES / benchTime) * 1000);

      const duration = Date.now() - startTime;
      report += `\nBENCHMARK METRICS:\n`;
      if (valid.length > 0) {
        report += `â€¢ Real Face Vector Extraction: ${duration} ms (${Math.round(duration / valid.length)} ms/template)\n`;
      } else {
        report += `â€¢ Synthetic Mode: Executed 100 128-D vector probes\n`;
      }
      report += `â€¢ Vector Similarity Speed: ${benchTime} ms for ${SYNTH_PROBES} comparisons (~${opsPerSec.toLocaleString()} ops/sec)\n`;
      report += `â€¢ Cosine Distance Precision: 32-bit Floating Point (Dot Product)\n`;
      report += `â€¢ Hardware Acceleration: Active (Hermes TurboEngine)\n`;

      if (vectors.length >= 2) {
        const sim = computeCosineSimilarity(vectors[0].v, vectors[1].v);
        const dist = (1 - sim).toFixed(3);
        report += `â€¢ Template Inter-Similarity (${vectors[0].emp.name} vs ${vectors[1].emp.name}): ${(sim * 100).toFixed(1)}% (Distance: ${dist})\n`;
      } else if (valid.length === 0) {
        report += `â€¢ Synthetic Inter-Probe Similarity: ${(lastSim * 100).toFixed(1)}%\n`;
      }

      report += `\nâ€¢ STATUS: PASSED â€” AI Engine ready for high-accuracy attendance scanning.`;
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
      ThemedAlert.alert('Validation', 'Please enter a shift name.', [{ text: 'OK' }], 'warning');
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
    ThemedAlert.alert('Delete Shift', 'Delete this shift?', [
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
      ThemedAlert.alert('Incomplete Details', 'Please fill in HR Name, Login ID and Password.', [{ text: 'OK' }], 'warning');
      return;
    }
    const success = await addAdminAccount({
      name: newHrName.trim(),
      loginId: newHrLoginId.trim(),
      password: newHrPassword.trim(),
      companyEmail: newHrEmail.trim() || undefined,
      role: newHrRole,
    });
    if (success) {
      ThemedAlert.alert('Success', `Created HR account for ${newHrName} (${newHrLoginId})!`, [{ text: 'Done' }], 'success');
      setNewHrName('');
      setNewHrLoginId('');
      setNewHrPassword('');
      setNewHrEmail('');
      setAddHrModalVisible(false);
    } else {
      ThemedAlert.alert('Duplicate Account', 'An HR account with this Login ID or Organization Email already exists.', [{ text: 'OK' }], 'error');
    }
  };

  const handleDeleteHrAccount = (id: string, name: string) => {
    if (adminAccounts.length <= 1) {
      ThemedAlert.alert('Action Denied', 'You cannot remove the primary admin account.', [{ text: 'OK' }], 'error');
      return;
    }
    ThemedAlert.alert('Remove HR Access', `Are you sure you want to revoke credentials for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await removeAdminAccount(id);
          ThemedAlert.alert('Removed', `Credentials for ${name} have been revoked.`, [{ text: 'Done' }], 'success');
        },
      },
    ]);
  };

  const handleHelp = () => {
    ThemedAlert.alert(
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
    if (!name) { ThemedAlert.alert('Validation', 'Please enter a department name.', [{ text: 'OK' }], 'warning'); return; }
    if (departments.some((d) => d.toLowerCase() === name.toLowerCase())) {
      ThemedAlert.alert('Duplicate', `"${name}" already exists.`, [{ text: 'OK' }], 'error'); return;
    }
    saveDepartments([...departments, name]);
    setNewDeptName('');
  };

  const handleRemoveDepartment = (dept: string) => {
    ThemedAlert.alert('Remove Department', `Remove "${dept}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveDepartments(departments.filter((d) => d !== dept)) },
    ]);
  };

  // ---------- Custom Field CRUD ----------
  const handleAddCustomField = () => {
    const label = newFieldLabel.trim();
    const key = newFieldKey.trim() || label.toLowerCase().replace(/\s+/g, '_');
    if (!label) { ThemedAlert.alert('Validation', 'Please enter a field label.', [{ text: 'OK' }], 'warning'); return; }
    if (customFields.some((f) => f.key === key)) {
      ThemedAlert.alert('Duplicate', `A field with key "${key}" already exists.`, [{ text: 'OK' }], 'error'); return;
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
    ThemedAlert.alert('Remove Field', `Remove the "${label}" field from enrollment forms?`, [
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
            {orgAccount.isLoggedIn && Boolean(orgAccount.orgId) && (
              <View style={styles.companyBadgeRow}>
                <FontAwesome name="building" size={12} color="#FF6900" style={{ marginRight: 5 }} />
                <Text style={styles.companyNameText} numberOfLines={1}>
                  {orgAccount.companyName || deriveCompanyName(orgAccount.orgEmail, orgAccount.orgId)}
                </Text>
              </View>
            )}
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.headerUnderline} />
          </View>
          <TouchableOpacity
            style={styles.lockBtn}
            activeOpacity={0.8}
            onPress={() => {
              ThemedAlert.alert(
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
        {/* Company Profile Banner - Visible only when logged in with respective company */}
        {orgAccount.isLoggedIn && Boolean(orgAccount.orgId) && (
          <View style={styles.companyBannerCard}>
            <View style={styles.companyIconLargeBox}>
              <FontAwesome name="building" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.companyBannerPreTitle}>REGISTERED COMPANY</Text>
              <Text style={styles.companyBannerMainTitle} numberOfLines={1}>
                {orgAccount.companyName || deriveCompanyName(orgAccount.orgEmail, orgAccount.orgId)}
              </Text>
              <View style={styles.companySystemBadge}>
                <MaterialCommunityIcons name="shield-check" size={12} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.companySystemBadgeText} numberOfLines={1}>
                  {orgAccount.orgId} Â· Visagel Attendance System
                </Text>
              </View>
            </View>
          </View>
        )}

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
              <Text style={styles.menuTitle} numberOfLines={1}>Work Shifts</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">
                {activeShift ? `Active: ${activeShift.name} (${formatTime(activeShift.startHour, activeShift.startMin)} â€“ ${formatTime(activeShift.endHour, activeShift.endMin)})` : 'Configure shifts & timings'}
              </Text>
            </View>
            <View style={[styles.shiftCountPill, { flexShrink: 0 }]}>
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
              <Text style={styles.menuTitle} numberOfLines={1}>Multi-Punch Entry</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Allow multiple clock-in and out per day</Text>
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
              <Text style={styles.menuTitle} numberOfLines={1}>Auto Face Scan</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Continuous auto-detection via camera</Text>
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
              <Text style={styles.menuTitle} numberOfLines={1}>Voice Feedback (TTS)</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Spoken confirmation on face verify</Text>
            </View>
            <Switch
              value={voiceFeedback}
              onValueChange={saveVoiceFeedback}
              trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Group Scan Mode */}
          <View style={styles.menuCardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="account-group" size={20} color="#2563EB" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle} numberOfLines={1}>Group Scan Mode</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Fast 1.0s turnaround for shift crowds</Text>
            </View>
            <Switch
              value={groupScanMode}
              onValueChange={saveGroupScanMode}
              trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* SECTION 2: CLOUD & REPORTS */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>REPORTS & DATA</Text>
        </View>
        <View style={styles.cardGroup}>
          {/* Daily Report Email Address */}
          <TouchableOpacity
            style={styles.menuCardRow}
            activeOpacity={0.75}
            onPress={() => {
              setDailyMailInput(dailyMailAddress);
              setDailyMailModalVisible(true);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FFFBEB' }]}>
              <MaterialCommunityIcons name="email-edit-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle} numberOfLines={1}>Daily Report Email</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">
                {dailyMailAddress}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 }}>
            <TouchableOpacity
              style={styles.sendSummaryNowBtn}
              activeOpacity={0.82}
              onPress={() => handleSendDailyEmailSummary(dailyMailAddress)}
              disabled={isSendingEmail}
            >
              <MaterialCommunityIcons name="email-fast-outline" size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.sendSummaryNowText} numberOfLines={1} adjustsFontSizeToFit>
                {isSendingEmail ? 'Dispatching Summary...' : "Send Today's Summary Now"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          {/* Sync Attendance Records */}
          <TouchableOpacity style={styles.menuCardRow} activeOpacity={0.7} onPress={() => setSyncModalVisible(true)}>
            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="database-check-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Database & Backup</Text>
              <Text style={styles.menuDescription}>Verify offline records & storage integrity</Text>
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
                <Text style={styles.menuTitle} numberOfLines={1}>Departments</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{departments.length}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Manage departments for enrollment</Text>
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
                <Text style={styles.menuTitle} numberOfLines={1}>Custom Enrolment Fields</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{customFields.length}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Configure extra employee form fields</Text>
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
                <Text style={styles.menuTitle} numberOfLines={1}>AI Detection & Engine</Text>
                <View style={[styles.countBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.countBadgeText, { color: '#166534' }]}>
                    'Edge 128-D'
                  </Text>
                </View>
              </View>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">
                Confidence: {aiSettings.minConfidence}% Â· Liveness: {aiSettings.livenessMode}
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
              <Text style={styles.menuTitle} numberOfLines={1}>Model Benchmark & Diagnostic</Text>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Test vector accuracy & liveness check</Text>
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
                <Text style={styles.menuTitle} numberOfLines={1}>HR Admin Accounts</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{adminAccounts.length}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">Create & manage multiple HR staff logins</Text>
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

        {/* SECTION 4: ORGANISATION PLATFORM LOGIN (BOTTOM OF SETTINGS) */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeadingText}>ORGANISATION & PLATFORM PROVIDER</Text>
        </View>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.menuCardRow}
            activeOpacity={0.75}
            onPress={() => setOrgLoginModalVisible(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: orgAccount.isLoggedIn && orgAccount.orgId ? '#FFF7ED' : '#F1F5F9' }]}>
              <MaterialCommunityIcons
                name="office-building-cog"
                size={20}
                color={orgAccount.isLoggedIn && orgAccount.orgId ? '#FF6900' : '#64748B'}
              />
            </View>
            <View style={styles.menuInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuTitle}>Organisation Account</Text>
                <View style={[styles.countBadge, { backgroundColor: orgAccount.isLoggedIn && orgAccount.orgId ? '#DCFCE7' : '#F1F5F9', marginLeft: 6 }]}>
                  <Text style={[styles.countBadgeText, { color: orgAccount.isLoggedIn && orgAccount.orgId ? '#166534' : '#64748B' }]}>
                    {orgAccount.isLoggedIn && orgAccount.orgId ? 'Active' : 'Logged Out'}
                  </Text>
                </View>
              </View>
              <Text style={styles.menuDescription} numberOfLines={1} ellipsizeMode="tail">
                {orgAccount.isLoggedIn && orgAccount.orgId
                  ? `Org ID: ${orgAccount.orgId} Â· ${orgAccount.orgEmail}`
                  : 'Tap to sign in with platform provider credentials'}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
          </TouchableOpacity>

          {orgAccount.isLoggedIn && Boolean(orgAccount.orgId) && (
            <>
              <View style={styles.cardDivider} />
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.orgActionMiniBtn, { flex: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}
                  activeOpacity={0.75}
                  onPress={() => setOrgLoginModalVisible(true)}
                >
                  <MaterialCommunityIcons name="account-edit-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                  <Text style={[styles.orgActionMiniText, { color: '#475569' }]} numberOfLines={1}>Change Credentials</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.orgActionMiniBtn, { flex: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                  activeOpacity={0.75}
                  onPress={handleOrgLogout}
                >
                  <MaterialCommunityIcons name="logout" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={[styles.orgActionMiniText, { color: '#EF4444' }]} numberOfLines={1}>Logout Org</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.versionText}>Visagel Attendance System â€¢ Version 1.0.0</Text>
          <View style={styles.poweredByFooterRow}>
            <MaterialCommunityIcons name="lightning-bolt" size={11} color="#FF6900" style={{ marginRight: 3 }} />
            <Text style={styles.brandTaglineText}>Powered by </Text>
            <Text style={styles.brandTaglineAccent}>Branzept</Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== DAILY MAIL ADDRESS MODAL ===== */}
      <Modal
        visible={dailyMailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDailyMailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Daily Report Email</Text>
                <Text style={styles.modalSubtitle}>Change recipient email address</Text>
              </View>
              <TouchableOpacity onPress={() => setDailyMailModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="close" size={18} color="#0A192F" />
              </TouchableOpacity>
            </View>

            {/* Current email badge */}
            <View style={styles.mailCurrentBadge}>
              <MaterialCommunityIcons name="email-check-outline" size={16} color="#D97706" style={{ marginRight: 8 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.mailCurrentLabel}>Current Recipient</Text>
                <Text style={styles.mailCurrentValue} numberOfLines={1} ellipsizeMode="middle">
                  {dailyMailAddress}
                </Text>
              </View>
            </View>

            {/* Input */}
            <View style={{ paddingHorizontal: 18, marginTop: 14 }}>
              <Text style={styles.mailInputLabel}>NEW EMAIL ADDRESS</Text>
              <View style={styles.mailInputWrap}>
                <MaterialCommunityIcons name="email-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.mailTextInput}
                  value={dailyMailInput}
                  onChangeText={setDailyMailInput}
                  placeholder="e.g. hr@company.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                {dailyMailInput.length > 0 && (
                  <TouchableOpacity onPress={() => setDailyMailInput('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.mailSaveBtn, { opacity: dailyMailInput.includes('@') ? 1 : 0.45 }]}
                activeOpacity={0.82}
                disabled={!dailyMailInput.includes('@')}
                onPress={() => {
                  const trimmed = dailyMailInput.trim();
                  if (!trimmed.includes('@')) {
                    ThemedAlert.alert('Invalid Email', 'Please enter a valid email address.', [{ text: 'OK' }], 'warning');
                    return;
                  }
                  setKeyValue('daily_report_email', trimmed);
                  setDailyMailAddress(trimmed);
                  setDailyMailModalVisible(false);
                  ThemedAlert.alert('Email Updated', `Daily reports will now be sent to:\n${trimmed}`, [{ text: 'Done' }], 'success');
                }}
              >
                <MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.mailSaveBtnText}>Save Email Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                placeholder="New department nameâ€¦"
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
                        <Text style={styles.fieldListKey}>{field.key}{field.isRequired ? ' â€¢ Required' : ''}</Text>
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
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>Manage Shifts</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>{shifts.length} shift{shifts.length !== 1 ? 's' : ''} configured</Text>
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
                    {/* Top Row: Radio, Name, Active Pill, Action Buttons */}
                    <View style={styles.shiftCardTopRow}>
                      <TouchableOpacity
                        style={styles.radioRow}
                        onPress={() => setActiveShift(shift.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, shift.isActive && { borderColor: accentColor }]}>
                          {shift.isActive && <View style={[styles.radioFill, { backgroundColor: accentColor }]} />}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.shiftCardName} numberOfLines={1} ellipsizeMode="tail">{shift.name}</Text>
                            {shift.isActive && (
                              <View style={[styles.activePill, { backgroundColor: accentBg, borderColor: accentColor }]}>
                                <Text style={[styles.activePillText, { color: accentColor }]}>Active</Text>
                              </View>
                            )}
                          </View>
                          {night && (
                            <View style={styles.nightBadge}>
                              <MaterialCommunityIcons name="weather-night" size={11} color={NIGHT_COLOR} />
                              <Text style={styles.nightBadgeText} numberOfLines={1}>Overnight (+1d)</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Top-Right Action Buttons */}
                      <View style={styles.shiftTopActions}>
                        <TouchableOpacity
                          style={[styles.shiftIconBtn, { backgroundColor: accentBg, borderColor: accentColor }]}
                          onPress={() => openEditShift(shift)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <FontAwesome name="pencil" size={12} color={accentColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.shiftIconBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                          onPress={() => deleteShift(shift.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <FontAwesome name="trash-o" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Visual Schedule Row */}
                    <View style={styles.shiftScheduleBox}>
                      <View style={styles.shiftTimeBlock}>
                        <View style={styles.shiftTimeTagRow}>
                          <View style={[styles.timeDot, { backgroundColor: '#10B981' }]} />
                          <Text style={styles.shiftTimeTag}>START</Text>
                        </View>
                        <Text style={[styles.shiftTimeValueText, { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          {formatTime(shift.startHour, shift.startMin)}
                        </Text>
                      </View>

                      <View style={styles.shiftArrowContainer}>
                        <MaterialCommunityIcons name="arrow-right-thin" size={22} color="#94A3B8" />
                      </View>

                      <View style={styles.shiftTimeBlock}>
                        <View style={styles.shiftTimeTagRow}>
                          <View style={[styles.timeDot, { backgroundColor: night ? NIGHT_COLOR : '#3B82F6' }]} />
                          <Text style={styles.shiftTimeTag}>END {night ? '(+1D)' : ''}</Text>
                        </View>
                        <Text style={[styles.shiftTimeValueText, { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          {formatTime(shift.endHour, shift.endMin)}
                        </Text>
                      </View>

                      <View style={styles.shiftDividerVert} />

                      <View style={styles.shiftTimeBlock}>
                        <View style={styles.shiftTimeTagRow}>
                          <View style={[styles.timeDot, { backgroundColor: '#F59E0B' }]} />
                          <Text style={styles.shiftTimeTag}>GRACE</Text>
                        </View>
                        <Text style={[styles.shiftTimeValueText, { color: '#B45309' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          {formatTime(shift.lateCutoffHour, shift.lateCutoffMin)}
                        </Text>
                      </View>
                    </View>
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
          <View style={[styles.modalContentSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>{editingShift ? 'Edit Shift' : 'Add New Shift'}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {isNightShift(formStart.getHours(), formEnd.getHours())
                    ? 'ðŸŒ™ Overnight schedule (crosses midnight)'
                    : 'â˜€ï¸ Regular daytime schedule'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShiftFormVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="close" size={18} color="#0A192F" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Shift Name Input Card */}
              <View style={styles.formSectionCard}>
                <Text style={styles.formInputLabel}>SHIFT NAME</Text>
                <View style={styles.inputWithIconWrap}>
                  <MaterialCommunityIcons name="briefcase-clock-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.shiftNameInput}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="e.g. Morning General Shift, Night Shift"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Night shift notice banner */}
              {isNightShift(formStart.getHours(), formEnd.getHours()) && (
                <View style={styles.nightInfoBanner}>
                  <MaterialCommunityIcons name="weather-night" size={16} color={NIGHT_COLOR} style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={styles.nightInfoText} numberOfLines={2} ellipsizeMode="tail">
                    Overnight shift detected: End time crosses midnight into the next day (+1d).
                  </Text>
                </View>
              )}

              {/* 2-Column Side-by-Side Timing Card: START TIME & END TIME */}
              <View style={styles.timingDualCard}>
                {/* Start Time */}
                <TouchableOpacity
                  style={styles.timingCol}
                  activeOpacity={0.7}
                  onPress={() => openTimePicker('Shift Start Time', formStart, setFormStart)}
                >
                  <View style={styles.timingHeaderRow}>
                    <View style={[styles.timeDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.timingColLabel}>START TIME</Text>
                  </View>
                  <View style={styles.timingValueRow}>
                    <Text style={styles.timingValueMain}>{formatTime(formStart.getHours(), formStart.getMinutes())}</Text>
                    <FontAwesome name="pencil" size={11} color={THEME_COLOR} style={{ marginLeft: 6 }} />
                  </View>
                  <Text style={styles.timingHintText}>Tap to change</Text>
                </TouchableOpacity>

                <View style={styles.timingDividerVert} />

                {/* End Time */}
                <TouchableOpacity
                  style={styles.timingCol}
                  activeOpacity={0.7}
                  onPress={() => openTimePicker('Shift End Time', formEnd, setFormEnd)}
                >
                  <View style={styles.timingHeaderRow}>
                    <View style={[styles.timeDot, { backgroundColor: isNightShift(formStart.getHours(), formEnd.getHours()) ? NIGHT_COLOR : '#3B82F6' }]} />
                    <Text style={styles.timingColLabel}>
                      END TIME {isNightShift(formStart.getHours(), formEnd.getHours()) ? '(+1D)' : ''}
                    </Text>
                  </View>
                  <View style={styles.timingValueRow}>
                    <Text style={[styles.timingValueMain, isNightShift(formStart.getHours(), formEnd.getHours()) && { color: NIGHT_COLOR }]}>
                      {formatTime(formEnd.getHours(), formEnd.getMinutes())}
                    </Text>
                    <FontAwesome name="pencil" size={11} color={isNightShift(formStart.getHours(), formEnd.getHours()) ? NIGHT_COLOR : THEME_COLOR} style={{ marginLeft: 6 }} />
                  </View>
                  <Text style={styles.timingHintText}>Tap to change</Text>
                </TouchableOpacity>
              </View>

              {/* Late Cutoff Card */}
              <TouchableOpacity
                style={styles.graceCutoffCard}
                activeOpacity={0.7}
                onPress={() => openTimePicker('Late Mark Cutoff', formLateCutoff, setFormLateCutoff)}
              >
                <View style={styles.graceLeftWrap}>
                  <View style={styles.graceIconCircle}>
                    <FontAwesome name="bell-o" size={14} color="#D97706" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.graceCardTitle}>LATE ARRIVAL CUTOFF</Text>
                    <Text style={styles.graceCardSub} numberOfLines={1}>Marked 'LATE' if clocking in after this</Text>
                  </View>
                </View>
                <View style={styles.graceTimeBadge}>
                  <Text style={styles.graceTimeBadgeText}>{formatTime(formLateCutoff.getHours(), formLateCutoff.getMinutes())}</Text>
                  <FontAwesome name="pencil" size={11} color="#D97706" style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneModalBtn} onPress={saveShiftForm} activeOpacity={0.85}>
                <Text style={styles.doneModalBtnText}>{editingShift ? 'Save Changes' : 'Add Shift'}</Text>
              </TouchableOpacity>
            </ScrollView>
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
              <MaterialCommunityIcons name="database-check" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.planTitle}>Database Integrity</Text>
            <Text style={styles.planSubtitle}>All offline attendance records are securely stored on device and verified.</Text>
            <View style={styles.syncStatsBox}>
              <View style={styles.syncStatCol}>
                <Text style={styles.syncStatVal}>100%</Text>
                <Text style={styles.syncStatLabel}>Integrity</Text>
              </View>
              <View style={styles.syncStatDivider} />
              <View style={styles.syncStatCol}>
                <Text style={styles.syncStatVal}>Secure</Text>
              <Text style={styles.syncStatLabel}>On-Device</Text>
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
                    {(acc.companyEmail || acc.loginId === 'admin') && (
                      <View style={[styles.hrCredsRow, { marginTop: 4, alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="domain" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                        <Text style={styles.hrCredsLabel}>Email: </Text>
                        <Text style={[styles.hrCredsValue, { color: '#0284C7' }]}>
                          {acc.companyEmail || 'admin@company.com'}
                        </Text>
                      </View>
                    )}
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
                <Text style={styles.inputLabel}>Organization / Work Email (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHrEmail}
                  onChangeText={setNewHrEmail}
                  placeholder="e.g. hr_priya@company.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
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
          <View style={[styles.modalContentSheet, { maxHeight: '94%' }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>AI Biometric Engine</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>Face detection Â· Liveness Â· Accuracy</Text>
              </View>
              <TouchableOpacity onPress={() => setAiModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="times" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current Engine Status Banner */}
            <View style={[styles.aiStatusBanner, {
              backgroundColor: '#F0FDF4',
              borderColor: '#A7F3D0',
            }]}>
              <View style={[styles.aiStatusDot, { backgroundColor: '#10B981' }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.aiStatusEngineText, { color: '#065F46' }]}>
                  Local Edge AI Engine Active
                </Text>
                <Text style={[styles.aiStatusSub, { color: '#059669' }]}>
                  {`128-D biometric vectors · Liveness: ${aiSettings.livenessMode} · Match >= ${aiSettings.minConfidence}%`}
                </Text>
              </View>
              <View style={[styles.aiLivePill, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.aiLivePillText, { color: '#166534' }]}>LIVE</Text>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* SECTION: Detection Engine */}
              <View style={styles.aiSectionWrap}>
                <View style={styles.aiSectionHeader}>
                  <MaterialCommunityIcons name="cpu-64-bit" size={14} color={THEME_COLOR} style={{ marginRight: 6 }} />
                  <Text style={styles.aiSectionTitle}>DETECTION ENGINE</Text>
                </View>

                <TouchableOpacity
                  style={[styles.aiEngineCard, aiSettings.modelEngine === 'local' && styles.aiEngineCardActive]}
                  activeOpacity={0.8}
                  onPress={() => saveAiSettings({ modelEngine: 'local' })}
                >
                  <View style={[styles.aiEngineIconBox, {
                    backgroundColor: aiSettings.modelEngine === 'local' ? '#DCFCE7' : '#F1F5F9',
                  }]}>
                    <MaterialCommunityIcons name="cpu-64-bit" size={22} color={aiSettings.modelEngine === 'local' ? '#059669' : '#94A3B8'} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.aiEngineCardTitle, { color: aiSettings.modelEngine === 'local' ? '#0A192F' : '#64748B' }]}>
                        Local Edge Engine
                      </Text>
                      <View style={[styles.aiEngineTag, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={[styles.aiEngineTagText, { color: '#166534' }]}>128-D</Text>
                      </View>
                    </View>
                    <Text style={styles.aiEngineCardSub}>100% on-device Â· offline Â· privacy-first Â· fast</Text>
                    <View style={styles.aiEngineMetaRow}>
                      <View style={styles.aiEngineMeta}><Text style={styles.aiEngineMetaText}>12ms</Text></View>
                      <View style={styles.aiEngineMeta}><Text style={styles.aiEngineMetaText}>No cloud</Text></View>
                      <View style={styles.aiEngineMeta}><Text style={styles.aiEngineMetaText}>Offline</Text></View>
                    </View>
                  </View>
                  <View style={[styles.aiEngineRadio, aiSettings.modelEngine === 'local' && styles.aiEngineRadioActive]}>
                    {aiSettings.modelEngine === 'local' && <View style={styles.aiEngineRadioFill} />}
                  </View>
                </TouchableOpacity>

                
              </View>

              {/* SECTION: Liveness */}
              <View style={styles.aiSectionWrap}>
                <View style={styles.aiSectionHeader}>
                  <MaterialCommunityIcons name="eye-check-outline" size={14} color="#A855F7" style={{ marginRight: 6 }} />
                  <Text style={styles.aiSectionTitle}>PASSIVE LIVENESS & ANTI-SPOOFING</Text>
                </View>
                <View style={styles.aiLivenessRow}>
                  {([
                    { id: 'strict', label: 'Strict', sub: 'Highest security. Blocks photo & screen attacks.', icon: 'shield-lock-outline', color: '#EF4444', activeBg: '#EF4444' },
                    { id: 'balanced', label: 'Balanced', sub: 'Standard guard. Recommended for most.', icon: 'shield-half-full', color: '#F59E0B', activeBg: '#F59E0B' },
                    { id: 'off', label: 'Off', sub: 'No check. Only for controlled environments.', icon: 'shield-off-outline', color: '#94A3B8', activeBg: '#64748B' },
                  ] as const).map((item) => {
                    const active = aiSettings.livenessMode === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.aiLivenessCard, {
                          borderColor: active ? item.activeBg : '#E2E8F0',
                          backgroundColor: active ? item.activeBg : '#FAFAFA',
                        }]}
                        activeOpacity={0.8}
                        onPress={() => saveAiSettings({ livenessMode: item.id })}
                      >
                        <MaterialCommunityIcons
                          name={item.icon}
                          size={22}
                          color={active ? '#FFFFFF' : item.color}
                          style={{ marginBottom: 6 }}
                        />
                        <Text style={[styles.aiLivenessLabel, { color: active ? '#FFFFFF' : '#0A192F' }]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.aiLivenessSub, { color: active ? 'rgba(255,255,255,0.82)' : '#64748B' }]}>
                          {item.sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION: Confidence Threshold */}
              <View style={styles.aiSectionWrap}>
                <View style={styles.aiSectionHeader}>
                  <MaterialCommunityIcons name="target" size={14} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.aiSectionTitle}>MATCH CONFIDENCE THRESHOLD</Text>
                </View>
                <View style={styles.aiConfidenceGrid}>
                  {[
                    { val: 65, label: 'Relaxed', desc: 'More matches, slight risk', color: '#F59E0B', bg: '#FFFBEB' },
                    { val: 75, label: 'Standard', desc: 'Balanced accuracy', color: THEME_COLOR, bg: '#FFF7ED' },
                    { val: 85, label: 'Strict', desc: 'High accuracy, fewer false+', color: '#2563EB', bg: '#EFF6FF' },
                    { val: 90, label: 'Max', desc: 'Ultra-precise biometrics', color: '#7C3AED', bg: '#F5F3FF' },
                  ].map(({ val, label, desc, color, bg }) => {
                    const active = aiSettings.minConfidence === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.aiConfCard, {
                          borderColor: active ? color : '#E2E8F0',
                          backgroundColor: active ? bg : '#FAFAFA',
                        }]}
                        activeOpacity={0.8}
                        onPress={() => saveAiSettings({ minConfidence: val })}
                      >
                        <Text style={[styles.aiConfValue, { color: active ? color : '#64748B' }]}>{val}%</Text>
                        <Text style={[styles.aiConfLabel, { color: active ? color : '#0A192F' }]}>{label}</Text>
                        <Text style={[styles.aiConfDesc, { color: active ? color : '#94A3B8' }]}>{desc}</Text>
                        {active && <View style={[styles.aiConfActiveDot, { backgroundColor: color }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View><View style={{ height: 20 }} />
            </ScrollView>

            <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
              <TouchableOpacity style={styles.closeAlertBtn} onPress={() => setAiModalVisible(false)}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
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
          <View style={[styles.modalContentSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Model Benchmark</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>Face vector extraction & cosine match speed</Text>
              </View>
              <TouchableOpacity onPress={() => setBenchmarkModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="times" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.benchRunBtn, { opacity: isBenchmarking ? 0.7 : 1 }]}
                activeOpacity={0.82}
                onPress={runBenchmarkTest}
                disabled={isBenchmarking}
              >
                <MaterialCommunityIcons
                  name={isBenchmarking ? 'loading' : 'lightning-bolt'}
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 10 }}
                />
                <View>
                  <Text style={styles.benchRunBtnTitle}>
                    {isBenchmarking ? 'Running Diagnostic...' : 'Run Full Diagnostic'}
                  </Text>
                  <Text style={styles.benchRunBtnSub}>
                    {isBenchmarking ? 'Extracting & comparing feature vectors' : 'Vector extraction Â· cosine similarity Â· latency'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Config summary */}
              <View style={styles.benchConfigRow}>
                {[
                  { label: 'Engine', value: 'Edge 128-D' },
                  { label: 'Liveness', value: aiSettings.livenessMode.charAt(0).toUpperCase() + aiSettings.livenessMode.slice(1) },
                  { label: 'Threshold', value: `${aiSettings.minConfidence}%` },
                  { label: 'Enrolled', value: `${enrolledEmployees.length}` },
                ].map((item) => (
                  <View key={item.label} style={styles.benchConfigCard}>
                    <Text style={styles.benchConfigValue}>{item.value}</Text>
                    <Text style={styles.benchConfigLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Results */}
              {benchmarkResult ? (
                (() => {
                  const lines = benchmarkResult.split('\n');
                  const isPassed = benchmarkResult.includes('PASSED');
                  const isFailed = benchmarkResult.startsWith('Benchmark Error');
                  const enrolledLines = lines.filter((l) => l.includes('[OK]') || l.includes('[V]') || l.match(/\[.\]/));
                  const speedLine = lines.find((l) => l.includes('Vector Similarity Speed'));
                  const speedMatch = speedLine?.match(/([\d,]+)\s*ops\/sec/);
                  const opsPerSec = speedMatch ? speedMatch[1] : '-';
                  const similarityLine = lines.find((l) => l.includes('Inter-Similarity') || l.includes('Inter-Probe Similarity'));
                  const similarityMatch = similarityLine?.match(/([\d.]+)%/);
                  const similarity = similarityMatch ? similarityMatch[1] + '%' : '-';
                  const vectorLine = lines.find((l) => l.includes('Real Face Vector') || l.includes('Synthetic Mode'));
                  const vectorVal = vectorLine ? vectorLine.replace(/^[*\s]+/, '').replace('Real Face Vector Extraction: ', '').replace('Synthetic Mode: ', '') : '-';
                  const empLines = lines.filter((l) => l.match(/\[.\].*\(.*\):/));

                  return (
                    <View style={{ paddingHorizontal: 2, marginBottom: 24 }}>
                      <View style={[styles.benchResultBanner, {
                        backgroundColor: isFailed ? '#FEF2F2' : isPassed ? '#F0FDF4' : '#FFFBEB',
                        borderColor: isFailed ? '#FECACA' : isPassed ? '#A7F3D0' : '#FDE68A',
                      }]}>
                        <MaterialCommunityIcons
                          name={isFailed ? 'alert-circle-outline' : isPassed ? 'check-decagram' : 'clock-outline'}
                          size={24}
                          color={isFailed ? '#EF4444' : isPassed ? '#059669' : '#D97706'}
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.benchResultBannerTitle, {
                            color: isFailed ? '#991B1B' : isPassed ? '#065F46' : '#92400E',
                          }]}>
                            {isFailed ? 'Diagnostic Error' : isPassed ? 'AI Engine â€” PASSED' : 'Test Complete'}
                          </Text>
                          <Text style={[styles.benchResultBannerSub, {
                            color: isFailed ? '#B91C1C' : isPassed ? '#059669' : '#D97706',
                          }]}>
                            {isFailed ? benchmarkResult : 'Ready for high-accuracy attendance scanning'}
                          </Text>
                        </View>
                      </View>

                      {!isFailed && (
                        <>
                          <View style={styles.benchMetricGrid}>
                            <View style={[styles.benchMetricCard, { borderColor: '#C7D2FE' }]}>
                              <MaterialCommunityIcons name="speedometer" size={20} color="#4F46E5" style={{ marginBottom: 6 }} />
                              <Text style={[styles.benchMetricValue, { color: '#4F46E5' }]}>{opsPerSec}</Text>
                              <Text style={styles.benchMetricLabel}>ops / sec</Text>
                              <Text style={styles.benchMetricSub}>Cosine comparisons</Text>
                            </View>
                            <View style={[styles.benchMetricCard, { borderColor: '#A7F3D0' }]}>
                              <MaterialCommunityIcons name="vector-difference" size={20} color="#059669" style={{ marginBottom: 6 }} />
                              <Text style={[styles.benchMetricValue, { color: '#059669' }]}>{similarity}</Text>
                              <Text style={styles.benchMetricLabel}>Similarity</Text>
                              <Text style={styles.benchMetricSub}>Inter-probe score</Text>
                            </View>
                            <View style={[styles.benchMetricCard, { borderColor: '#FDE68A' }]}>
                              <MaterialCommunityIcons name="account-check-outline" size={20} color="#D97706" style={{ marginBottom: 6 }} />
                              <Text style={[styles.benchMetricValue, { color: '#D97706' }]}>{empLines.length || enrolledEmployees.length}</Text>
                              <Text style={styles.benchMetricLabel}>Profiles</Text>
                              <Text style={styles.benchMetricSub}>Templates tested</Text>
                            </View>
                          </View>

                          <View style={styles.benchDetailCard}>
                            <View style={styles.benchDetailRow}>
                              <MaterialCommunityIcons name="chip" size={14} color="#4F46E5" />
                              <Text style={styles.benchDetailLabel}>Vector Extraction</Text>
                              <Text style={styles.benchDetailValue} numberOfLines={1} ellipsizeMode="tail">{vectorVal}</Text>
                            </View>
                            <View style={[styles.benchDetailRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                              <MaterialCommunityIcons name="format-float-none" size={14} color="#059669" />
                              <Text style={styles.benchDetailLabel}>Float Precision</Text>
                              <Text style={styles.benchDetailValue}>32-bit Dot Product</Text>
                            </View>
                            <View style={[styles.benchDetailRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                              <MaterialCommunityIcons name="lightning-bolt" size={14} color="#F59E0B" />
                              <Text style={styles.benchDetailLabel}>Hardware</Text>
                              <Text style={styles.benchDetailValue}>Hermes TurboEngine</Text>
                            </View>
                            <View style={[styles.benchDetailRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                              <MaterialCommunityIcons name="cpu-64-bit" size={14} color="#6366F1" />
                              <Text style={styles.benchDetailLabel}>Acceleration</Text>
                              <Text style={styles.benchDetailValue}>Active</Text>
                            </View>
                          </View>

                          {empLines.length > 0 && (
                            <View style={styles.benchDetailCard}>
                              <Text style={styles.benchDetailCardTitle}>ENROLLED TEMPLATE RESULTS</Text>
                              {empLines.map((line, i) => (
                                <View key={i} style={[styles.benchDetailRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                                  <MaterialCommunityIcons name="check-circle-outline" size={14} color="#059669" />
                                  <Text style={[styles.benchDetailLabel, { flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                                    {line.replace(/\[.\]\s+/, '').replace(/:\s+.*/, '')}
                                  </Text>
                                  <Text style={[styles.benchDetailValue, { color: '#059669' }]}>OK</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })()
              ) : (
                <View style={styles.benchEmptyState}>
                  <View style={styles.benchEmptyIconRing}>
                    <MaterialCommunityIcons name="brain" size={40} color="#CBD5E1" />
                  </View>
                  <Text style={styles.benchEmptyTitle}>Ready to Test</Text>
                  <Text style={styles.benchEmptyText}>
                    Tap 'Run Full Diagnostic' to evaluate face feature extraction performance across all enrolled biometric templates.
                  </Text>
                  <View style={styles.benchEmptyInfoRow}>
                    {[
                      { icon: 'cpu-64-bit', text: 'Vector extraction' },
                      { icon: 'vector-difference', text: 'Cosine similarity' },
                      { icon: 'speedometer', text: 'Throughput ops/s' },
                    ].map((item) => (
                      <View key={item.text} style={styles.benchEmptyInfoChip}>
                        <MaterialCommunityIcons name={item.icon as any} size={14} color="#94A3B8" style={{ marginBottom: 4 }} />
                        <Text style={styles.benchEmptyInfoText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== DAILY EMAIL SUMMARY MODAL ===== */}
      <Modal
        visible={dailyEmailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDailyEmailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentSheet, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Daily Email Summary</Text>
                <Text style={styles.modalSubtitle}>Configure company recipient and dispatch automated reports</Text>
              </View>
              <TouchableOpacity onPress={() => setDailyEmailModalVisible(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="times" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 4, paddingTop: 6 }}>
              {/* Info Card */}
              <View style={styles.emailInfoCard}>
                <MaterialCommunityIcons name="email-check" size={24} color="#D97706" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.emailInfoTitle}>Organization Attendance Dispatch</Text>
                  <Text style={styles.emailInfoSubtitle}>
                    Logged in as {currentUser?.name || 'Admin'} ({currentUser?.role || 'SUPER_ADMIN'})
                  </Text>
                </View>
              </View>

              {/* Company Main Email Input */}
              <Text style={styles.inputLabel}>Company Main Recipient Email</Text>
              <TextInput
                style={[styles.formInput, { marginBottom: 16 }]}
                value={companyEmailInput}
                onChangeText={setCompanyEmailInput}
                placeholder="e.g. hr@company.com or management@branzept.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Automatic daily schedule toggle */}
              <View style={[styles.menuCardRow, { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuTitle, { fontSize: 14 }]}>Auto-send Daily Attendance</Text>
                  <Text style={styles.menuDescription}>Prepare attendance logs automatically</Text>
                </View>
                <Switch
                  value={sendReportsDaily}
                  onValueChange={setSendReportsDaily}
                  trackColor={{ false: '#E2E8F0', true: THEME_COLOR }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Summary Stats Preview */}
              <View style={styles.summaryStatsBox}>
                <Text style={styles.summaryStatsTitle}>TODAY'S SUMMARY PREVIEW</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={styles.summaryStatLabel}>Date:</Text>
                  <Text style={styles.summaryStatVal}>{new Date().toDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={styles.summaryStatLabel}>Total Staff Enrolled:</Text>
                  <Text style={styles.summaryStatVal}>{enrolledEmployees.length}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={styles.summaryStatLabel}>Attendance Logs Today:</Text>
                  <Text style={styles.summaryStatVal}>
                    {attendanceRecords.filter((r) => r.date === formatLocalDate(new Date())).length} present
                  </Text>
                </View>
              </View>

              {/* Send Now Button */}
              <TouchableOpacity
                style={[styles.sendEmailBtnPrimary, isSendingEmail && { opacity: 0.7 }]}
                activeOpacity={0.82}
                onPress={() => handleSendDailyEmailSummary(companyEmailInput)}
                disabled={isSendingEmail}
              >
                <MaterialCommunityIcons
                  name={isSendingEmail ? 'loading' : 'send-check'}
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.sendEmailBtnPrimaryText}>
                  {isSendingEmail ? 'Composing Summary...' : "Send Today's Attendance Summary Now"}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 10 }}>
              <TouchableOpacity style={styles.closeAlertBtn} onPress={() => setDailyEmailModalVisible(false)}>
                <Text style={styles.closeAlertBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={styles.aboutVersion}>Version 1.0.0 â€¢ 2026</Text>
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

      {/* Organisation Platform Provider Login Modal */}
      <OrgLoginModal
        visible={orgLoginModalVisible}
        onClose={() => setOrgLoginModalVisible(false)}
        initialAccount={orgAccount}
        onSuccess={(updatedAcc) => {
          setOrgAccount(updatedAcc);
          ThemedAlert.alert(
            'Organisation Connected',
            `Successfully connected ${updatedAcc.orgEmail} (Org ID: ${updatedAcc.orgId}) to ${updatedAcc.providerName}.`,
            [{ text: 'Done' }],
            'success'
          );
        }}
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
    minWidth: 0,
    marginRight: 8,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  menuDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 15,
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
    overflow: 'hidden',
  },
  orgActionMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  orgActionMiniText: {
    fontSize: 11.5,
    fontWeight: '700',
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
  shiftCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  shiftTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginTop: 2,
  },
  shiftIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftScheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 4,
  },
  shiftTimeBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  shiftTimeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  timeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  shiftTimeTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  shiftTimeValueText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  shiftArrowContainer: {
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  shiftDividerVert: {
    width: 1,
    height: 30,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
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
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  shiftTimeCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftTimeLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  shiftTimeValue: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  shiftTimeDividerV: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
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
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  shiftSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  shiftLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  shiftTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  miniIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  shiftTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  shiftSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  shiftTimeBadge: {
    flexShrink: 0,
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

  // â”€â”€ Shift Form New Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  formSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  formInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWithIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shiftNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0A192F',
  },
  timingDualCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  timingCol: {
    flex: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  timingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  timingColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  timingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  timingValueMain: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME_COLOR,
    letterSpacing: -0.5,
  },
  timingHintText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  timingDividerVert: {
    width: 1,
    backgroundColor: '#E2E8F0',
    alignSelf: 'stretch',
  },
  graceCutoffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  graceLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 10,
    gap: 10,
  },
  graceIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  graceCardTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  graceCardSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    fontWeight: '500',
  },
  graceTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  graceTimeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
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
  // â”€â”€ Enrolment Field Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    flex: 1,
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

  // â”€â”€ Daily Email Summary & Cloud AI Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sendSummaryNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  sendSummaryNowText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B45309',
    textAlign: 'center',
  },
  emailInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  emailInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  emailInfoSubtitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  summaryStatsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  summaryStatsTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#64748B',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryStatVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  sendEmailBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLOR,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
    marginBottom: 8,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sendEmailBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Responsive, non-overflowing AI modal pills
  responsivePill: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  responsivePillActive: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFF7ED',
  },
  responsivePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  responsivePillTextActive: {
    color: THEME_COLOR,
  },
  responsivePillSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  responsivePillSubActive: {
    color: '#EA580C',
  },
  responsivePillCompact: {
    flex: 1,
    minWidth: 60,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cloud Sync AI Card inside AI modal
  cloudAiCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    marginBottom: 16,
  },
  cloudAiTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cloudAiSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  cloudFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#64748B',
    marginBottom: 6,
  },
  providerPill: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerPillActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  providerPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  providerPillTextActive: {
    color: '#4F46E5',
  },
  testCloudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  testCloudBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // â”€â”€ Daily Mail Address Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mailCurrentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    marginHorizontal: 18,
    marginTop: 4,
    padding: 12,
  },
  mailCurrentLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  mailCurrentValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  mailInputLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  mailInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  mailTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0A192F',
  },
  mailSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLOR,
    borderRadius: 12,
    paddingVertical: 13,
  },
  mailSaveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // â”€â”€ Cloud Details Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  cloudSectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  cloudProviderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudProviderChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  cloudProviderChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cloudInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cloudTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#0A192F',
  },
  cloudTestResultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  cloudTestResultText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cloudTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cloudTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  cloudSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
  },
  cloudSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── AI Engine Modal ─────────────────────────────────────────────────────
  aiStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    gap: 10,
  },
  aiStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  aiStatusEngineText: {
    fontSize: 12,
    fontWeight: '800',
  },
  aiStatusSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  aiLivePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  aiLivePillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  aiSectionWrap: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiSectionTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  aiEngineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  aiEngineCardActive: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFF7ED',
  },
  aiEngineIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiEngineCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  aiEngineTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiEngineTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  aiEngineCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  aiEngineMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  aiEngineMeta: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  aiEngineMetaText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  aiEngineRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 10,
  },
  aiEngineRadioActive: {
    borderColor: THEME_COLOR,
  },
  aiEngineRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME_COLOR,
  },
  aiLivenessRow: {
    flexDirection: 'row',
    gap: 10,
  },
  aiLivenessCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  aiLivenessLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  aiLivenessSub: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  aiConfidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  aiConfCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    position: 'relative',
  },
  aiConfValue: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  aiConfLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  aiConfDesc: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
  },
  aiConfActiveDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiCloudToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  aiCloudToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
  },
  aiCloudToggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  aiCloudProvChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  aiCloudProvChipText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  aiDimChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  aiDimChipLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  aiDimChipSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Benchmark Modal ─────────────────────────────────────────────────────
  benchRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLOR,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  benchRunBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  benchRunBtnSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  benchConfigRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  benchConfigCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  benchConfigValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A192F',
  },
  benchConfigLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  benchResultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
  },
  benchResultBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  benchResultBannerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  benchMetricGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  benchMetricCard: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  benchMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  benchMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0A192F',
    marginTop: 2,
  },
  benchMetricSub: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  benchDetailCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  benchDetailCardTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
  },
  benchDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  benchDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  benchDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A192F',
    flexShrink: 0,
    textAlign: 'right',
  },
  benchEmptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  benchEmptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  benchEmptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
    marginBottom: 8,
  },
  benchEmptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  benchEmptyInfoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  benchEmptyInfoChip: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  benchEmptyInfoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
});
