import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAttendance, EmployeeAttendance } from '@/context/AttendanceContext';
import { getDepartmentMeta } from '@/utils/departmentIcons';
import * as Calendar from 'expo-calendar';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME = '#FF6900';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
type SortKey = 'name' | 'timeIn' | 'timeOut' | 'punches' | 'department' | 'duration';
type StatusFilter = 'all' | 'in_only' | 'out_only' | 'complete' | 'no_out';
type QuickDate = 'today' | 'yesterday' | 'custom';

function parseMinutes(t: string): number {
  if (!t || t === '--:--') return Infinity;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) ? Infinity : h * 60 + (m || 0);
}

function calcDuration(inTime: string, outTime: string): string {
  const inMin = parseMinutes(inTime);
  const outMin = parseMinutes(outTime);
  if (inMin === Infinity || outMin === Infinity || outMin <= inMin) return '--';
  const diff = outMin - inMin;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { attendanceRecords, multipleTimeEntries, removePunch, departments } = useAttendance();

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [quickDate, setQuickDate] = useState<QuickDate>('today');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('timeIn');
  const [sortAsc, setSortAsc] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [selectedEmpPunches, setSelectedEmpPunches] = useState<EmployeeAttendance | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPunchIds, setSelectedPunchIds] = useState<string[]>([]);

  const applyQuickDate = (q: QuickDate) => {
    setQuickDate(q);
    if (q === 'today') {
      setDate(new Date());
    } else if (q === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setDate(d);
    }
  };

  const selectedDateStr = date.toISOString().split('T')[0];
  const dayRecords = attendanceRecords.filter((r) => r.date === selectedDateStr);
  const deptList = ['All', ...departments];

  const filteredRecords = useMemo(() => {
    let list = dayRecords.filter((r) => {
      const matchesDept = selectedDept === 'All' || r.department === selectedDept;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q);
      const hasIn = r.punches.some((p) => p.type === 'IN');
      const hasOut = r.punches.some((p) => p.type === 'OUT');
      let matchesStatus = true;
      if (statusFilter === 'in_only') matchesStatus = hasIn && !hasOut;
      else if (statusFilter === 'out_only') matchesStatus = !hasIn && hasOut;
      else if (statusFilter === 'complete') matchesStatus = hasIn && hasOut;
      else if (statusFilter === 'no_out') matchesStatus = hasIn && !hasOut;
      return matchesDept && matchesSearch && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      const aIn = a.punches.find((p) => p.type === 'IN')?.time || 'ZZ:ZZ';
      const bIn = b.punches.find((p) => p.type === 'IN')?.time || 'ZZ:ZZ';
      const aOut = [...a.punches].reverse().find((p) => p.type === 'OUT')?.time || '';
      const bOut = [...b.punches].reverse().find((p) => p.type === 'OUT')?.time || '';
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'timeIn') cmp = aIn.localeCompare(bIn);
      else if (sortKey === 'timeOut') cmp = (aOut || 'ZZ').localeCompare(bOut || 'ZZ');
      else if (sortKey === 'punches') cmp = a.punches.length - b.punches.length;
      else if (sortKey === 'department') cmp = (a.department || '').localeCompare(b.department || '');
      else if (sortKey === 'duration') {
        const aD = parseMinutes(aOut) - parseMinutes(aIn);
        const bD = parseMinutes(bOut) - parseMinutes(bIn);
        cmp = (isFinite(aD) ? aD : 0) - (isFinite(bD) ? bD : 0);
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [dayRecords, searchQuery, selectedDept, statusFilter, sortKey, sortAsc]);

  const stats = useMemo(() => {
    const present = dayRecords.length;
    const complete = dayRecords.filter(
      (r) => r.punches.some((p) => p.type === 'IN') && r.punches.some((p) => p.type === 'OUT')
    ).length;
    const inOnly = dayRecords.filter(
      (r) => r.punches.some((p) => p.type === 'IN') && !r.punches.some((p) => p.type === 'OUT')
    ).length;
    const deptSet = new Set(dayRecords.map((r) => r.department || 'General'));
    return { present, complete, inOnly, depts: deptSet.size };
  }, [dayRecords]);

  const activeFilterCount = [
    selectedDept !== 'All',
    statusFilter !== 'all',
    searchQuery.trim().length > 0,
    sortKey !== 'timeIn',
  ].filter(Boolean).length;

  const handleDeletePunch = (employeeId: string, date: string, punchId: string, punchTime: string) => {
    Alert.alert('Remove Punch', `Remove the ${punchTime} punch entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await removePunch(employeeId, date, punchId);
          setSelectedEmpPunches((prev) =>
            prev ? { ...prev, punches: prev.punches.filter((p) => p.id !== punchId) } : null
          );
        },
      },
    ]);
  };

  const toggleSelectPunch = (punchId: string) => {
    setSelectedPunchIds((prev) =>
      prev.includes(punchId) ? prev.filter((id) => id !== punchId) : [...prev, punchId]
    );
  };

  const handleBatchDelete = () => {
    if (selectedPunchIds.length === 0) return;
    Alert.alert('Delete Selected Punches', `Remove ${selectedPunchIds.length} selected punch(es)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive',
        onPress: async () => {
          if (!selectedEmpPunches) return;
          for (const punchId of selectedPunchIds) {
            await removePunch(selectedEmpPunches.employeeId, selectedEmpPunches.date, punchId);
          }
          setSelectedEmpPunches((prev) =>
            prev ? { ...prev, punches: prev.punches.filter((p) => !selectedPunchIds.includes(p.id)) } : null
          );
          setSelectedPunchIds([]);
          setIsMultiSelectMode(false);
        },
      },
    ]);
  };

  const handleCalendarIntegration = async () => {
    try {
      if (dayRecords.length === 0) {
        Alert.alert('Notice', `No attendance records found for ${date.toLocaleDateString()} to sync.`);
        return;
      }

      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Calendar permission is required to save attendance logs to your device calendar.');
        return;
      }

      // Find an available editable calendar or primary calendar
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      let targetCalendar = calendars.find((c) => c.isPrimary && c.allowsModifications) ||
                           calendars.find((c) => c.allowsModifications) ||
                           calendars[0];

      if (!targetCalendar) {
        Alert.alert('No Calendar', 'Could not find a writable calendar on your device.');
        return;
      }

      // Build structured event details
      const eventTitle = `📊 Attendance Report: ${dayRecords.length} Present (${date.toLocaleDateString()})`;
      const completeCount = dayRecords.filter(
        (r) => r.punches.some((p) => p.type === 'IN') && r.punches.some((p) => p.type === 'OUT')
      ).length;

      let eventNotes = `VISAGEL DAILY ATTENDANCE SUMMARY\n`;
      eventNotes += `Date: ${selectedDateStr}\n`;
      eventNotes += `Total Present: ${dayRecords.length}\n`;
      eventNotes += `Full Day Shifts: ${completeCount}\n`;
      eventNotes += `In-Progress: ${dayRecords.length - completeCount}\n\n`;
      eventNotes += `── EMPLOYEE LOGS ──\n`;

      dayRecords.forEach((r, idx) => {
        const firstIn = r.punches.find((p) => p.type === 'IN')?.time || '--:--';
        const lastOut = [...r.punches].reverse().find((p) => p.type === 'OUT')?.time || '--:--';
        const dur = calcDuration(firstIn, lastOut);
        eventNotes += `${idx + 1}. [${r.employeeId}] ${r.name} (${r.department || 'General'}) | In: ${firstIn} | Out: ${lastOut} | Dur: ${dur}\n`;
      });

      // Set event for the selected date 09:00 to 18:00
      const startDate = new Date(date);
      startDate.setHours(9, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(18, 0, 0, 0);

      const eventId = await Calendar.createEventAsync(targetCalendar.id, {
        title: eventTitle,
        notes: eventNotes,
        startDate,
        endDate,
        allDay: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      });

      if (eventId) {
        Alert.alert(
          'Calendar Synced! 📅',
          `Attendance summary with ${dayRecords.length} employee records was added to your device calendar for ${date.toLocaleDateString()}.`
        );
      }
    } catch (error: unknown) {
      Alert.alert('Calendar Sync Failed', error instanceof Error ? error.message : 'Unknown calendar error');
    }
  };

  const exportToCSV = async () => {
    try {
      const records = filteredRecords;
      if (records.length === 0) {
        Alert.alert('Notice', 'No records to export with current filters.');
        return;
      }
      let csv = 'SI No.,Employee ID,Name,Department,Date,First In,Last Out,Duration,Total Punches,Status,Punch Log\n';
      records.forEach((r, idx) => {
        const firstIn = r.punches.find((p) => p.type === 'IN')?.time || 'N/A';
        const lastOut = [...r.punches].reverse().find((p) => p.type === 'OUT')?.time || 'N/A';
        const dur = calcDuration(firstIn, lastOut);
        const hasIn = r.punches.some((p) => p.type === 'IN');
        const hasOut = r.punches.some((p) => p.type === 'OUT');
        const status = hasIn && hasOut ? 'Complete' : hasIn ? 'In Only' : 'Out Only';
        const punchLog = r.punches.map((p) => `[${p.type}: ${p.time}]`).join(' | ');
        csv += `${idx + 1},"${r.employeeId}","${r.name}","${r.department || 'General'}","${r.date}","${firstIn}","${lastOut}","${dur}","${r.punches.length}","${status}","${punchLog}"\n`;
      });
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDir) { Alert.alert('Error', 'Storage unavailable'); return; }
      const fileUri = `${baseDir}attendance_${selectedDateStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (!(await Sharing.isAvailableAsync())) { Alert.alert('Error', 'Sharing not available'); return; }
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Attendance Report' });
    } catch (err: unknown) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const closeDetail = () => {
    setSelectedEmpPunches(null);
    setIsMultiSelectMode(false);
    setSelectedPunchIds([]);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedDept('All');
    setStatusFilter('all');
    setSortKey('timeIn');
    setSortAsc(true);
  };

  const statusOptions: { key: StatusFilter; label: string; icon: string; color: string }[] = [
    { key: 'all', label: 'All', icon: 'account-multiple', color: '#64748B' },
    { key: 'complete', label: 'Complete', icon: 'check-circle', color: '#059669' },
    { key: 'in_only', label: 'In Only', icon: 'login', color: '#2563EB' },
    { key: 'out_only', label: 'Out Only', icon: 'logout', color: '#7C3AED' },
    { key: 'no_out', label: 'No Exit', icon: 'alert-circle', color: '#D97706' },
  ];

  const sortOptions: { key: SortKey; label: string; icon: string }[] = [
    { key: 'timeIn', label: 'Time In', icon: 'clock-in' },
    { key: 'timeOut', label: 'Time Out', icon: 'clock-out' },
    { key: 'name', label: 'Name', icon: 'sort-alphabetical-ascending' },
    { key: 'punches', label: 'Punches', icon: 'gesture-tap' },
    { key: 'duration', label: 'Duration', icon: 'timer' },
    { key: 'department', label: 'Dept', icon: 'office-building' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Header Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.companyBadgeRow}>
              <FontAwesome name="building" size={11} color={THEME} style={{ marginRight: 5 }} />
              <Text style={styles.companyNameText}>Branzept</Text>
            </View>
            <Text style={styles.headerTitle}>Attendance Report</Text>
            <View style={styles.headerUnderline} />
          </View>
          <TouchableOpacity
            style={styles.lockBtn}
            onPress={() =>
              Alert.alert('Lock Screen', 'Return to Attendance Screen?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Lock', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
              ])
            }
          >
            <FontAwesome name="lock" size={12} color="#EF4444" style={{ marginRight: 5 }} />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Quick Date Row Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <View style={styles.quickDateRow}>
          {(['today', 'yesterday'] as QuickDate[]).map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.quickDateBtn, quickDate === q && styles.quickDateBtnActive]}
              onPress={() => applyQuickDate(q)}
            >
              <Text style={[styles.quickDateBtnText, quickDate === q && styles.quickDateBtnTextActive]}>
                {q === 'today' ? 'Today' : 'Yesterday'}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.dateSelector, quickDate === 'custom' && { borderColor: THEME }]}
            onPress={() => { setShowPicker(true); setQuickDate('custom'); }}
          >
            <FontAwesome name="calendar" size={13} color={THEME} style={{ marginRight: 7 }} />
            <Text style={styles.dateSelectorText}>
              {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <FontAwesome name="chevron-down" size={9} color={THEME} style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>

        <AppDateTimePicker
          visible={showPicker}
          value={date}
          mode="date"
          title="Select Date"
          themeColor={THEME}
          onChange={(d) => setDate(d)}
          onClose={() => setShowPicker(false)}
        />

        {/* ── Stats 2x2 Grid (Fits screen without overflow) ── */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Present Today', value: stats.present, icon: 'account-check', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
            { label: 'Full Day (In+Out)', value: stats.complete, icon: 'check-decagram', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
            { label: 'In Only / Pending', value: stats.inOnly, icon: 'account-clock', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
            { label: 'Depts Active', value: stats.depts, icon: 'office-building-outline', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.border }]}>
              <View style={[styles.statIconBox, { backgroundColor: s.color + '15' }]}>
                <MaterialCommunityIcons name={s.icon as any} size={18} color={s.color} />
              </View>
              <View style={styles.statContent}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={exportToCSV}>
            <FontAwesome name="download" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: '#0A192F' }]} onPress={handleCalendarIntegration}>
            <FontAwesome name="calendar-check-o" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Sync Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search + Filter Toggle ── */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <FontAwesome name="search" size={13} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, ID, department…"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome name="times-circle" size={14} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterToggleBtn, showFilterPanel && styles.filterToggleBtnActive]}
            onPress={() => setShowFilterPanel((v) => !v)}
          >
            <MaterialCommunityIcons name="tune-vertical" size={18} color={showFilterPanel ? '#FFFFFF' : THEME} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Department Filter Pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptScroll}>
          {deptList.map((dept) => {
            const isSelected = selectedDept === dept;
            const dMeta = getDepartmentMeta(dept === 'All' ? null : dept);
            return (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.deptPill,
                  isSelected
                    ? [styles.deptPillActive, dept !== 'All' && { backgroundColor: dMeta.color, borderColor: dMeta.color }]
                    : styles.deptPillInactive,
                ]}
                onPress={() => setSelectedDept(dept)}
              >
                <MaterialCommunityIcons
                  name={dept === 'All' ? ('view-list' as any) : (dMeta.icon as any)}
                  size={11}
                  color={isSelected ? '#FFFFFF' : dept === 'All' ? '#64748B' : dMeta.color}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.deptPillText, isSelected ? styles.deptPillTextActive : styles.deptPillTextInactive]}>
                  {dept}
                </Text>
                {dept !== 'All' && (
                  <View style={[styles.deptCountBubble, { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : dMeta.bg }]}>
                    <Text style={[styles.deptCountText, { color: isSelected ? '#FFFFFF' : dMeta.color }]}>
                      {dayRecords.filter((r) => r.department === dept).length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Expandable Full Filter & Sort Panel ── */}
        {showFilterPanel && (
          <View style={styles.filterPanel}>
            <View style={styles.filterPanelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="tune" size={16} color={THEME} />
                <Text style={styles.filterPanelTitle}>Filters & Sorting</Text>
              </View>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearAllFilters} style={styles.resetHeaderBtn}>
                  <Text style={styles.resetHeaderBtnText}>Reset All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Department Filter Section inside Modal Panel */}
            <Text style={styles.filterSectionLabel}>
              <MaterialCommunityIcons name="office-building" size={13} color="#64748B" /> Department
            </Text>
            <View style={styles.filterChipRow}>
              {deptList.map((dept) => {
                const isSelected = selectedDept === dept;
                const dMeta = getDepartmentMeta(dept === 'All' ? null : dept);
                const count = dept === 'All' ? dayRecords.length : dayRecords.filter((r) => r.department === dept).length;
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[
                      styles.filterChip,
                      isSelected && {
                        backgroundColor: (dept === 'All' ? THEME : dMeta.color) + '20',
                        borderColor: dept === 'All' ? THEME : dMeta.color,
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => setSelectedDept(dept)}
                  >
                    <MaterialCommunityIcons
                      name={dept === 'All' ? 'domain' : (dMeta.icon as any)}
                      size={12}
                      color={isSelected ? (dept === 'All' ? THEME : dMeta.color) : '#64748B'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.filterChipText, isSelected && { color: dept === 'All' ? THEME : dMeta.color, fontWeight: '800' }]}>
                      {dept} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Punch Status */}
            <Text style={[styles.filterSectionLabel, { marginTop: 14 }]}>
              <MaterialCommunityIcons name="account-clock" size={13} color="#64748B" /> Attendance Status
            </Text>
            <View style={styles.filterChipRow}>
              {statusOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    statusFilter === opt.key && {
                      backgroundColor: opt.color + '20',
                      borderColor: opt.color,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => setStatusFilter(opt.key)}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={12}
                    color={statusFilter === opt.key ? opt.color : '#94A3B8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.filterChipText, statusFilter === opt.key && { color: opt.color, fontWeight: '800' }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sort Options */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
              <Text style={[styles.filterSectionLabel, { marginBottom: 0 }]}>
                <MaterialCommunityIcons name="sort" size={13} color="#64748B" /> Sort Options
              </Text>
              {/* Order direction toggle button */}
              <TouchableOpacity
                style={styles.sortOrderToggleBtn}
                onPress={() => setSortAsc((v) => !v)}
              >
                <MaterialCommunityIcons
                  name={sortAsc ? 'sort-ascending' : 'sort-descending'}
                  size={14}
                  color={THEME}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.sortOrderToggleText}>
                  {sortAsc ? 'Ascending (A-Z / Earliest)' : 'Descending (Z-A / Latest)'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterChipRow}>
              {sortOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    sortKey === opt.key && styles.filterChipSort,
                  ]}
                  onPress={() => toggleSort(opt.key)}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={13}
                    color={sortKey === opt.key ? THEME : '#94A3B8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.filterChipText, sortKey === opt.key && { color: THEME, fontWeight: '800' }]}>
                    {opt.label}
                  </Text>
                  {sortKey === opt.key && (
                    <MaterialCommunityIcons
                      name={sortAsc ? 'arrow-up' : 'arrow-down'}
                      size={10}
                      color={THEME}
                      style={{ marginLeft: 3 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                <MaterialCommunityIcons name="filter-remove" size={13} color="#EF4444" style={{ marginRight: 5 }} />
                <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Active Filter Chips Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeFilterCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 8 }}>
            {selectedDept !== 'All' && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>Dept: {selectedDept}</Text>
                <TouchableOpacity onPress={() => setSelectedDept('All')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <FontAwesome name="times" size={9} color="#7C3AED" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              </View>
            )}
            {statusFilter !== 'all' && (
              <View style={[styles.activeChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Text style={[styles.activeChipText, { color: '#059669' }]}>
                  {statusOptions.find((s) => s.key === statusFilter)?.label}
                </Text>
                <TouchableOpacity onPress={() => setStatusFilter('all')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <FontAwesome name="times" size={9} color="#059669" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              </View>
            )}
            {sortKey !== 'timeIn' && (
              <View style={[styles.activeChip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                <Text style={[styles.activeChipText, { color: THEME }]}>
                  Sort: {sortOptions.find((s) => s.key === sortKey)?.label} {sortAsc ? 'Ã¢â€ â€˜' : 'Ã¢â€ â€œ'}
                </Text>
                <TouchableOpacity onPress={() => { setSortKey('timeIn'); setSortAsc(true); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <FontAwesome name="times" size={9} color={THEME} style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              </View>
            )}
            {searchQuery.trim().length > 0 && (
              <View style={[styles.activeChip, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                <Text style={[styles.activeChipText, { color: '#16A34A' }]}>&quot;{searchQuery.trim()}&quot;</Text>
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <FontAwesome name="times" size={9} color="#16A34A" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Attendance Log Header ── */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Attendance Log</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filteredRecords.length}/{dayRecords.length}</Text>
            </View>
          </View>
          <View style={styles.punchModeTag}>
            <MaterialCommunityIcons
              name={multipleTimeEntries ? 'clock-fast' : 'clock-check-outline'}
              size={12}
              color="#C2410C"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.punchModeTagText}>{multipleTimeEntries ? 'Multi-Punch Active' : 'Standard In/Out'}</Text>
          </View>
        </View>

        {/* ── Attendance Log Records ── */}
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={40} color="#CBD5E1" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>
              {dayRecords.length === 0 ? 'No Attendance Records' : 'No Matching Records'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {dayRecords.length === 0
                ? `No attendance marked for ${date.toLocaleDateString()}`
                : 'Adjust your search or filter criteria'}
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.emptyResetBtn} onPress={clearAllFilters}>
                <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredRecords.map((item) => {
              const firstIn = item.punches.find((p) => p.type === 'IN')?.time || '--:--';
              const lastOut = [...item.punches].reverse().find((p) => p.type === 'OUT')?.time || '--:--';
              const dur = calcDuration(firstIn, lastOut);
              const hasIn = item.punches.some((p) => p.type === 'IN');
              const hasOut = item.punches.some((p) => p.type === 'OUT');
              const dMeta = getDepartmentMeta(item.department);
              const statusDot =
                hasIn && hasOut
                  ? { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Full Day (Completed)', icon: 'check-decagram' as const }
                  : hasIn
                  ? { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'In Progress (In Only)', icon: 'clock-alert-outline' as const }
                  : { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Out Recorded', icon: 'logout' as const };

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.punchCard, { borderTopColor: statusDot.color }]}
                  activeOpacity={0.88}
                  onPress={() => { setIsMultiSelectMode(false); setSelectedPunchIds([]); setSelectedEmpPunches(item); }}
                >
                  {/* Card Header Profile Row */}
                  <View style={styles.punchCardHeader}>
                    <View style={[styles.punchAvatarBox, { backgroundColor: statusDot.bg, borderColor: statusDot.border }]}>
                      <FontAwesome name="user" size={16} color={statusDot.color} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.punchEmpName}>{item.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusDot.bg, borderColor: statusDot.border }]}>
                          <MaterialCommunityIcons name={statusDot.icon as any} size={11} color={statusDot.color} style={{ marginRight: 3 }} />
                          <Text style={[styles.statusBadgeText, { color: statusDot.color }]}>{statusDot.label}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.punchEmpId}>{item.employeeId}</Text>
                        {item.department && (
                          <View style={[styles.deptTag, { backgroundColor: dMeta.bg, borderColor: dMeta.border || '#E2E8F0' }]}>
                            <MaterialCommunityIcons name={dMeta.icon as any} size={10} color={dMeta.color} style={{ marginRight: 3 }} />
                            <Text style={[styles.deptTagText, { color: dMeta.color }]}>{item.department}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Punch Timeline Meter Visual */}
                  <View style={styles.punchVisualContainer}>
                    <View style={styles.punchVisualItem}>
                      <View style={styles.punchVisualPointIn}>
                        <MaterialCommunityIcons name="login" size={12} color="#059669" />
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.punchVisualLabel}>First In</Text>
                        <Text style={styles.punchVisualValueIn}>{firstIn}</Text>
                      </View>
                    </View>

                    <View style={styles.punchVisualCenter}>
                      <View style={styles.punchVisualTrack}>
                        <View style={[styles.punchVisualTrackFill, { width: hasIn && hasOut ? '100%' : hasIn ? '50%' : '0%' }]} />
                      </View>
                      <View style={styles.punchVisualDurationBadge}>
                        <MaterialCommunityIcons name="timer-outline" size={11} color="#64748B" style={{ marginRight: 3 }} />
                        <Text style={styles.punchVisualDurationText}>{dur}</Text>
                      </View>
                    </View>

                    <View style={styles.punchVisualItemRight}>
                      <View style={{ marginRight: 8, alignItems: 'flex-end' }}>
                        <Text style={styles.punchVisualLabel}>Last Out</Text>
                        <Text style={styles.punchVisualValueOut}>{lastOut}</Text>
                      </View>
                      <View style={styles.punchVisualPointOut}>
                        <MaterialCommunityIcons name="logout" size={12} color="#C2410C" />
                      </View>
                    </View>
                  </View>

                  {/* Punch Activity Stream & Log Count */}
                  <View style={styles.punchCardFooter}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {item.punches.map((p, idx) => (
                        <View
                          key={p.id || idx}
                          style={[
                            styles.miniPunchChip,
                            p.type === 'IN' ? styles.miniPunchChipIn : styles.miniPunchChipOut,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={p.type === 'IN' ? 'arrow-down-bold' : 'arrow-up-bold'}
                            size={9}
                            color={p.type === 'IN' ? '#059669' : '#C2410C'}
                            style={{ marginRight: 2 }}
                          />
                          <Text style={[styles.miniPunchText, { color: p.type === 'IN' ? '#059669' : '#C2410C' }]}>
                            {p.time}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>

                    <View style={styles.viewTimelineArrowBox}>
                      <Text style={styles.viewTimelineText}>{item.punches.length} {item.punches.length === 1 ? 'log' : 'logs'}</Text>
                      <FontAwesome name="chevron-right" size={10} color="#FF6900" style={{ marginLeft: 4 }} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Detail Punch Timeline Modal (Slide Up Drawer) ── */}
      <Modal visible={!!selectedEmpPunches} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHandle} />

            {/* Modal Header */}
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.detailTitle}>{selectedEmpPunches?.name}</Text>
                  {selectedEmpPunches?.department && (() => {
                    const dMeta = getDepartmentMeta(selectedEmpPunches.department);
                    return (
                      <View style={[styles.deptTag, { backgroundColor: dMeta.bg, borderColor: dMeta.border || '#E2E8F0' }]}>
                        <MaterialCommunityIcons name={dMeta.icon as any} size={10} color={dMeta.color} style={{ marginRight: 3 }} />
                        <Text style={[styles.deptTagText, { color: dMeta.color }]}>{selectedEmpPunches.department}</Text>
                      </View>
                    );
                  })()}
                </View>

                <Text style={styles.detailSubtitle}>
                  ID: {selectedEmpPunches?.employeeId}  •  {selectedEmpPunches?.date}
                </Text>

                {/* Duration summary bar */}
                {(() => {
                  const mIn = selectedEmpPunches?.punches.find((p) => p.type === 'IN')?.time || '';
                  const mOut = [...(selectedEmpPunches?.punches || [])].reverse().find((p) => p.type === 'OUT')?.time || '';
                  const dur = calcDuration(mIn, mOut);
                  return (
                    <View style={styles.modalDurationBar}>
                      <View style={styles.modalDurationItem}>
                        <Text style={styles.modalDurationLabel}>First Entry</Text>
                        <Text style={styles.modalDurationValIn}>{mIn || '--:--'}</Text>
                      </View>
                      <View style={styles.modalDurationDivider} />
                      <View style={styles.modalDurationItem}>
                        <Text style={styles.modalDurationLabel}>Last Exit</Text>
                        <Text style={styles.modalDurationValOut}>{mOut || '--:--'}</Text>
                      </View>
                      <View style={styles.modalDurationDivider} />
                      <View style={styles.modalDurationItem}>
                        <Text style={styles.modalDurationLabel}>Total Hours</Text>
                        <Text style={styles.modalDurationValTotal}>{dur}</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              <TouchableOpacity style={styles.closeDetailBtn} onPress={closeDetail}>
                <FontAwesome name="close" size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Timeline Stream */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="timeline-clock-outline" size={16} color={THEME} />
                  <Text style={styles.timelineSectionTitle}>
                    Activity Timeline ({selectedEmpPunches?.punches.length})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.toggleSelectBtn}
                  onPress={() => { setIsMultiSelectMode(!isMultiSelectMode); setSelectedPunchIds([]); }}
                >
                  <Text style={styles.toggleSelectBtnText}>{isMultiSelectMode ? 'Cancel Selection' : 'Manage Logs'}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {selectedEmpPunches?.punches.map((punch, pIdx) => {
                  const isSelected = selectedPunchIds.includes(punch.id);
                  const isLast = pIdx === (selectedEmpPunches?.punches.length || 0) - 1;

                  return (
                    <TouchableOpacity
                      key={punch.id}
                      style={[
                        styles.timelineRowContainer,
                        isMultiSelectMode && isSelected && { backgroundColor: '#FEF2F2', borderRadius: 12 },
                      ]}
                      activeOpacity={isMultiSelectMode ? 0.7 : 1}
                      onPress={() => { if (isMultiSelectMode) toggleSelectPunch(punch.id); }}
                    >
                      {/* Left Multi-select checkbox */}
                      {isMultiSelectMode && (
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxChecked]}>
                          {isSelected && <FontAwesome name="check" size={9} color="#FFFFFF" />}
                        </View>
                      )}

                      {/* Continuous Timeline vertical line & node */}
                      <View style={styles.timelineNodeColumn}>
                        <View
                          style={[
                            styles.timelineNode,
                            punch.type === 'IN' ? styles.timelineNodeIn : styles.timelineNodeOut,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={punch.type === 'IN' ? 'login' : 'logout'}
                            size={11}
                            color="#FFFFFF"
                          />
                        </View>
                        {!isLast && <View style={styles.timelineConnectorLine} />}
                      </View>

                      {/* Content Card for this punch log */}
                      <View style={[styles.timelineLogBox, punch.type === 'IN' ? styles.timelineLogBoxIn : styles.timelineLogBoxOut]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.timelineTypeTag, punch.type === 'IN' ? { color: '#059669' } : { color: '#C2410C' }]}>
                              {punch.type === 'IN' ? 'PUNCH IN (ENTRY)' : 'PUNCH OUT (EXIT)'}
                            </Text>
                            <View style={styles.timelineIndexTag}>
                              <Text style={styles.timelineIndexTagText}>#{pIdx + 1}</Text>
                            </View>
                          </View>
                          <Text style={styles.timelineTimeText}>{punch.time}</Text>
                        </View>

                        {!isMultiSelectMode && (
                          <TouchableOpacity
                            style={styles.deletePunchBtn}
                            onPress={() => handleDeletePunch(selectedEmpPunches!.employeeId, selectedEmpPunches!.date, punch.id, punch.time)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {isMultiSelectMode && selectedPunchIds.length > 0 ? (
              <TouchableOpacity style={styles.batchDeleteBtn} onPress={handleBatchDelete}>
                <MaterialCommunityIcons name="trash-can" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.batchDeleteBtnText}>Delete Selected ({selectedPunchIds.length})</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.closeModalBtn} onPress={closeDetail}>
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  companyBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  companyNameText: { fontSize: 11, fontWeight: '800', color: THEME, letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0A192F', letterSpacing: 0.3 },
  headerUnderline: { width: 32, height: 3, backgroundColor: THEME, marginTop: 4, borderRadius: 2 },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  lockBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  scrollContent: { padding: 16, paddingBottom: 36 },

  // Quick Date
  quickDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  quickDateBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  quickDateBtnActive: { backgroundColor: THEME, borderColor: THEME },
  quickDateBtnText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  quickDateBtnTextActive: { color: '#FFFFFF' },
  dateSelector: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FFEDD5',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
  },
  dateSelectorText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0A192F' },

  // Stats 2x2 Grid (No overflow, responsive 2-column layout)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: {
    flexDirection: 'row', backgroundColor: THEME,
    paddingVertical: 11, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: THEME, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 3, elevation: 2,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A', padding: 0 },
  filterToggleBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FFEDD5',
    alignItems: 'center', justifyContent: 'center',
  },
  filterToggleBtnActive: { backgroundColor: THEME, borderColor: THEME },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

  // Dept Pills
  deptScroll: { gap: 8, paddingVertical: 2, marginBottom: 10 },
  deptPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
  },
  deptPillActive: { backgroundColor: THEME, borderColor: THEME },
  deptPillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  deptPillText: { fontSize: 12, fontWeight: '700' },
  deptPillTextActive: { color: '#FFFFFF' },
  deptPillTextInactive: { color: '#64748B' },
  deptCountBubble: { marginLeft: 5, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  deptCountText: { fontSize: 10, fontWeight: '800' },

  // Filter Panel
  filterPanel: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#FFEDD5',
    padding: 16, marginBottom: 14,
    shadowColor: THEME, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  filterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterPanelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  resetHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  resetHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortOrderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sortOrderToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME,
  },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterChipSort: { backgroundColor: '#FFF7ED', borderColor: THEME, borderWidth: 1.5 },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  clearFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  clearFiltersBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },

  // Active chips
  activeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE',
  },
  activeChipText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  countBadge: {
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 6,
  },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: THEME },
  punchModeTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  punchModeTagText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 36, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 12 },
  emptyResetBtn: {
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5',
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10,
  },
  emptyResetBtnText: { fontSize: 12, fontWeight: '700', color: THEME },

  // Redesigned Modern Punch Card
  punchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopWidth: 4,
    padding: 15,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  punchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  punchAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchEmpName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  punchEmpId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  deptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  deptTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },

  // Punch Timeline Meter Visual
  punchVisualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  punchVisualItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  punchVisualItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  punchVisualPointIn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchVisualPointOut: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchVisualLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  punchVisualValueIn: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  punchVisualValueOut: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  punchVisualCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  punchVisualTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  punchVisualTrackFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  punchVisualDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  punchVisualDurationText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },

  // Punch Activity Stream & Footer
  punchCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  miniPunchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniPunchChipIn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  miniPunchChipOut: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  miniPunchText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewTimelineArrowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 6,
  },
  viewTimelineText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6900',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.72)',
    justifyContent: 'flex-end',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1.5,
    borderColor: '#FFEDD5',
    shadowColor: THEME,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  detailHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  modalDurationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalDurationItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalDurationDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
  },
  modalDurationLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  modalDurationValIn: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    marginTop: 1,
  },
  modalDurationValOut: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C2410C',
    marginTop: 1,
  },
  modalDurationValTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    marginTop: 1,
  },
  closeDetailBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  toggleSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  toggleSelectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  timelineRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxChecked: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  timelineNodeColumn: {
    width: 28,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: 6,
  },
  timelineNodeIn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  timelineNodeOut: {
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  timelineConnectorLine: {
    width: 2,
    height: 38,
    backgroundColor: '#CBD5E1',
    marginTop: 2,
  },
  timelineLogBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  timelineLogBoxIn: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  timelineLogBoxOut: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  timelineTypeTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timelineIndexTag: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  timelineIndexTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  timelineTimeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  deletePunchBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  closeModalBtn: {
    backgroundColor: THEME,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: THEME,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  closeModalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  batchDeleteBtn: {
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  batchDeleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
