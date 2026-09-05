import React, { useState } from 'react';
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
import { ThemedAlert } from '@/components/ThemedAlertProvider';
import { getOrgPlatformAccountDb, deriveCompanyName } from '@/utils/database';
import * as Calendar from 'expo-calendar';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME_COLOR = '#FF6900';

export default function DashboardScreen() {
  const router = useRouter();
  const { logout, currentUser } = useAuth();
  const { attendanceRecords, multipleTimeEntries, recordPunch, removePunch, departments } = useAttendance();
  const [orgAccount] = useState(() => getOrgPlatformAccountDb());
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [selectedEmpPunches, setSelectedEmpPunches] = useState<EmployeeAttendance | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Present' | 'Late' | 'Half Day'>('All');
  const [selectedPunchType, setSelectedPunchType] = useState<'All' | 'IN Only' | 'OUT Only'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'time' | 'punches'>('name');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const hasActiveFilters = selectedDept !== 'All' || selectedStatus !== 'All' || selectedPunchType !== 'All' || sortBy !== 'name';
  const activeFiltersCount = (selectedDept !== 'All' ? 1 : 0) + (selectedStatus !== 'All' ? 1 : 0) + (selectedPunchType !== 'All' ? 1 : 0) + (sortBy !== 'name' ? 1 : 0);
  const resetFilters = () => {
    setSelectedDept('All');
    setSelectedStatus('All');
    setSelectedPunchType('All');
    setSortBy('name');
  };

  const selectedDateStr = date.toISOString().split('T')[0];
  const dayRecords = attendanceRecords.filter((r) => r.date === selectedDateStr);

  // Dept filter list (always has 'All' first)
  const deptList = ['All', ...departments];

  // Filtered records applying dept filter + status + punch type + search + sorting
  const filteredRecords = dayRecords
    .filter((r) => {
      const matchesDept = selectedDept === 'All' || r.department === selectedDept;
      
      const matchesStatus =
        selectedStatus === 'All' ||
        (selectedStatus === 'Present' && (r.status === 'PRESENT' || r.punches.length > 0)) ||
        (selectedStatus === 'Late' && r.status === 'LATE') ||
        (selectedStatus === 'Half Day' && r.status === 'HALF_DAY');

      let matchesPunchType = true;
      if (selectedPunchType === 'IN Only') {
        const lastPunch = r.punches[r.punches.length - 1];
        matchesPunchType = lastPunch ? lastPunch.type === 'IN' : false;
      } else if (selectedPunchType === 'OUT Only') {
        const lastPunch = r.punches[r.punches.length - 1];
        matchesPunchType = lastPunch ? lastPunch.type === 'OUT' : false;
      }

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q);

      return matchesDept && matchesStatus && matchesPunchType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'punches') {
        return b.punches.length - a.punches.length;
      }
      if (sortBy === 'time') {
        const lastA = a.punches[a.punches.length - 1]?.time || '';
        const lastB = b.punches[b.punches.length - 1]?.time || '';
        return lastB.localeCompare(lastA);
      }
      return 0;
    });

  const stats = {
    markedToday: dayRecords.length,
    totalEnrolled: Math.max(dayRecords.length, 2),
  };

  const handleDeletePunch = (employeeId: string, date: string, punchId: string, punchTime: string) => {
    ThemedAlert.alert(
      'Remove Punch',
      `Remove the ${punchTime} punch entry for this employee?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removePunch(employeeId, date, punchId);
            // Update the local modal state so it re-renders immediately
            setSelectedEmpPunches((prev) =>
              prev
                ? { ...prev, punches: prev.punches.filter((p) => p.id !== punchId) }
                : null
            );
          },
        },
      ]
    );
  };

  const handleCalendarIntegration = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        ThemedAlert.alert('Permission Required', 'Calendar permission is required to sync attendance logs to device calendar.', [{ text: 'OK' }], 'warning');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      let targetCal = calendars.find((c) => c.title === 'Visagel Attendance' || c.name === 'Visagel Attendance') ||
                      calendars.find((c) => c.isPrimary) ||
                      calendars.find((c) => c.allowsModifications) ||
                      calendars[0];

      if (!targetCal) {
        const newId = await Calendar.createCalendarAsync({
          title: 'Visagel Attendance',
          color: '#FF6900',
          entityType: Calendar.EntityTypes.EVENT,
          source: {
            isLocalAccount: true,
            name: 'Visagel',
            type: Calendar.SourceType.LOCAL,
          },
          name: 'Visagel Attendance',
          ownerAccount: 'Visagel',
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
        });
        targetCal = { id: newId, title: 'Visagel Attendance' } as any;
      }

      const startDate = new Date(selectedDateStr + 'T09:00:00');
      const endDate = new Date(selectedDateStr + 'T18:00:00');
      const title = `Visagel Attendance: ${dayRecords.length} Present (${selectedDateStr})`;
      const notes =
        `Daily Attendance Summary for ${selectedDateStr}\n` +
        `Total Present: ${dayRecords.length}\n` +
        (dayRecords.length > 0
          ? dayRecords
              .map(
                (r, i) =>
                  `${i + 1}. ${r.name} (${r.employeeId}) [${r.department || 'General'}]: ${r.punches
                    .map((p) => `${p.type} ${p.time}`)
                    .join(' -> ')}`
              )
              .join('\n')
          : 'No attendance logs recorded for this day.');

      await Calendar.createEventAsync(targetCal.id, {
        title,
        startDate,
        endDate,
        notes,
        location: 'Visagel Smart Face Terminal',
        alarms: [{ relativeOffset: -15 }],
      });

      ThemedAlert.alert(
        'Calendar Synced!',
        `Successfully added attendance summary event for ${selectedDateStr} to your calendar ("${targetCal.title}"). Total ${dayRecords.length} staff records linked.`,
        [{ text: 'Awesome', style: 'default' }],
        'success'
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown calendar error occurred';
      ThemedAlert.alert('Calendar Sync Error', errMsg, [{ text: 'OK' }], 'error');
    }
  };

  const handleSendEmailSummary = async () => {
    try {
      const companyEmail = currentUser?.companyEmail || 'admin@company.com';
      const companyName = currentUser?.companyName || 'Visagel Enterprise';

      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        ThemedAlert.alert('Email Unavailable', 'Email composition is not available on this device.', [{ text: 'OK' }], 'error');
        return;
      }

      let csvContent = 'SI No.,Employee ID,Name,Department,Date,Status,First In,Last Out,Total Punches,Punch Log\n';
      dayRecords.forEach((r, idx) => {
        const firstIn = r.punches.find((p) => p.type === 'IN')?.time || 'N/A';
        const lastOut = [...r.punches].reverse().find((p) => p.type === 'OUT')?.time || 'N/A';
        const punchLog = r.punches.map((p) => `[${p.type}: ${p.time}]`).join(' | ');
        csvContent += `${idx + 1},"${r.employeeId}","${r.name}","${r.department || 'General'}","${r.date}","${r.status}","${firstIn}","${lastOut}","${r.punches.length}","${punchLog}"\n`;
      });

      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const fileUri = `${baseDir}visagel_daily_summary_${selectedDateStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      const emailBody =
        `Dear Team,\n\n` +
        `Here is the Daily Attendance Summary for ${selectedDateStr}:\n\n` +
        `• Organization: ${companyName}\n` +
        `• Target Date: ${selectedDateStr}\n` +
        `• Staff Present: ${dayRecords.length}\n` +
        `• Total Enrolled: ${stats.totalEnrolled}\n` +
        `• Logged Admin: ${currentUser?.name || 'Admin'} (${currentUser?.loginId || 'admin'})\n\n` +
        `Attached CSV contains all raw biometric punch stamps.\n\n` +
        `Generated by Visagel Facial Attendance System.`;

      await MailComposer.composeAsync({
        recipients: [companyEmail],
        subject: `[Daily Attendance Report] ${companyName} - ${selectedDateStr}`,
        body: emailBody,
        attachments: [fileUri],
      });

      ThemedAlert.alert('Email Ready', `Daily attendance summary dispatched to ${companyEmail}.`, [{ text: 'Done', style: 'default' }], 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compose email.';
      ThemedAlert.alert('Email Error', msg, [{ text: 'OK' }], 'error');
    }
  };

  const exportToCSV = async () => {
    try {
      if (dayRecords.length === 0) {
        ThemedAlert.alert('Notice', 'No attendance records available for this date to export.', [{ text: 'OK' }], 'info');
        return;
      }

      let csvContent = 'SI No.,Employee ID,Name,Date,First In,Last Out,Total Punches,Punch Log\n';
      dayRecords.forEach((r, idx) => {
        const firstIn = r.punches.find((p) => p.type === 'IN')?.time || 'N/A';
        const lastOut = [...r.punches].reverse().find((p) => p.type === 'OUT')?.time || 'N/A';
        const punchLog = r.punches.map((p) => `[${p.type}: ${p.time}]`).join(' | ');
        csvContent += `${idx + 1},"${r.employeeId}","${r.name}","${r.date}","${firstIn}","${lastOut}","${r.punches.length}","${punchLog}"\n`;
      });

      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDir) {
        ThemedAlert.alert('Error', 'Storage directory not available', [{ text: 'OK' }], 'error');
        return;
      }
      const fileUri = `${baseDir}attendance_report_${selectedDateStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (!(await Sharing.isAvailableAsync())) {
        ThemedAlert.alert('Error', 'Sharing is not available on this device', [{ text: 'OK' }], 'error');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Daily Attendance Report',
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown export error occurred';
      ThemedAlert.alert('Export Failed', errMsg, [{ text: 'OK' }], 'error');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Title */}
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
            <Text style={styles.headerTitle}>Attendance Report</Text>
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
        {/* Date Selector Dropdown Button */}
        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome name="calendar" size={15} color="#FF6900" style={{ marginRight: 10 }} />
            <Text style={styles.dateSelectorText}>{date.toDateString()}</Text>
          </View>
          <View style={styles.changeDateTag}>
            <Text style={styles.changeDateText}>Change</Text>
            <FontAwesome name="chevron-down" size={10} color="#FF6900" style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        <AppDateTimePicker
          visible={showPicker}
          value={date}
          mode="date"
          title="Select Date"
          themeColor="#FF6900"
          onChange={(newDate) => setDate(newDate)}
          onClose={() => setShowPicker(false)}
        />

        {/* Top Overview Cards */}
        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrapGreen}>
              <MaterialCommunityIcons name="account-check" size={20} color="#059669" />
            </View>
            <View>
              <Text style={styles.metricValue}>{stats.markedToday}</Text>
              <Text style={styles.metricLabel}>Present Today</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconWrapBlue}>
              <MaterialCommunityIcons name="account-group" size={20} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.metricValue}>{stats.totalEnrolled}</Text>
              <Text style={styles.metricLabel}>Total Enrolled</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, { flex: 1 }]} onPress={exportToCSV} activeOpacity={0.8}>
            <FontAwesome name="download" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { flex: 1, backgroundColor: '#0A192F' }]} onPress={handleCalendarIntegration} activeOpacity={0.8}>
            <FontAwesome name="calendar-check-o" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>Sync Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { flex: 1, backgroundColor: '#059669' }]} onPress={handleSendEmailSummary} activeOpacity={0.8}>
            <MaterialCommunityIcons name="email-fast-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>Email Summary</Text>
          </TouchableOpacity>
        </View>

        {/* Search & Expandable Filters Container */}
        <View style={styles.filterContainer}>
          {/* Search input with Filter Button */}
          <View style={styles.searchAndFilterRow}>
            <View style={styles.searchBox}>
              <FontAwesome name="search" size={13} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name or ID…"
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
              style={[
                styles.filterToggleBtn,
                isFilterExpanded && styles.filterToggleBtnActive,
                hasActiveFilters && styles.filterToggleBtnHasFilter,
              ]}
              onPress={() => setIsFilterExpanded(!isFilterExpanded)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={18}
                color={hasActiveFilters ? '#FFFFFF' : isFilterExpanded ? THEME_COLOR : '#475569'}
              />
              {activeFiltersCount > 0 && (
                <View style={styles.filterBadgeCount}>
                  <Text style={styles.filterBadgeCountText}>{activeFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Compact summary when collapsed & active */}
          {!isFilterExpanded && hasActiveFilters && (
            <View style={styles.activeFilterSummaryBar}>
              <MaterialCommunityIcons name="filter-check" size={12} color={THEME_COLOR} style={{ marginRight: 4 }} />
              <Text style={styles.activeFilterSummaryText} numberOfLines={1}>
                {[selectedDept !== 'All' ? `Dept: ${selectedDept}` : null, selectedStatus !== 'All' ? `Status: ${selectedStatus}` : null, selectedPunchType !== 'All' ? `Punch: ${selectedPunchType}` : null, sortBy !== 'name' ? `Sorted: ${sortBy}` : null].filter(Boolean).join(' · ')}
              </Text>
              <TouchableOpacity onPress={resetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={14} color="#94A3B8" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* Expandable Filter Drawer */}
          {isFilterExpanded && (
            <View style={styles.expandableFilterCard}>
              <View style={styles.filterCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="tune-variant" size={13} color={THEME_COLOR} style={{ marginRight: 4 }} />
                  <Text style={styles.filterCardHeading}>ADVANCED FILTERS</Text>
                </View>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={resetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.filterResetLink}>Reset Filters</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Department pills */}
              <Text style={styles.filterSectionLabel}>DEPARTMENT</Text>
              <View style={styles.pillsWrapRow}>
                {deptList.map((dept) => (
                  <TouchableOpacity
                    key={dept}
                    style={[
                      styles.compactPill,
                      selectedDept === dept ? styles.compactPillActive : styles.compactPillInactive,
                    ]}
                    onPress={() => setSelectedDept(dept)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.compactPillText,
                        selectedDept === dept ? styles.compactPillTextActive : styles.compactPillTextInactive,
                      ]}
                    >
                      {dept}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Status Filter Pills */}
              <Text style={[styles.filterSectionLabel, { marginTop: 10 }]}>ATTENDANCE STATUS</Text>
              <View style={styles.pillsWrapRow}>
                {(['All', 'Present', 'Late', 'Half Day'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.compactPill,
                      selectedStatus === st ? styles.compactPillActive : styles.compactPillInactive,
                    ]}
                    onPress={() => setSelectedStatus(st)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.compactPillText,
                        selectedStatus === st ? styles.compactPillTextActive : styles.compactPillTextInactive,
                      ]}
                    >
                      {st === 'All' ? 'All Status' : st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Punch Activity Section */}
              <Text style={[styles.filterSectionLabel, { marginTop: 10 }]}>PUNCH ACTIVITY</Text>
              <View style={styles.pillsWrapRow}>
                {(['All', 'IN Only', 'OUT Only'] as const).map((pt) => (
                  <TouchableOpacity
                    key={pt}
                    style={[
                      styles.compactPill,
                      selectedPunchType === pt ? styles.compactPillActive : styles.compactPillInactive,
                    ]}
                    onPress={() => setSelectedPunchType(pt)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.compactPillText,
                        selectedPunchType === pt ? styles.compactPillTextActive : styles.compactPillTextInactive,
                      ]}
                    >
                      {pt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort Section */}
              <Text style={[styles.filterSectionLabel, { marginTop: 10 }]}>SORT BY</Text>
              <View style={styles.pillsWrapRow}>
                {(
                  [
                    { id: 'name', label: 'Name (A-Z)' },
                    { id: 'time', label: 'Recent Punch' },
                    { id: 'punches', label: 'Punch Count' },
                  ] as const
                ).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.compactPill,
                      sortBy === s.id ? styles.compactPillActive : styles.compactPillInactive,
                    ]}
                    onPress={() => setSortBy(s.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.compactPillText,
                        sortBy === s.id ? styles.compactPillTextActive : styles.compactPillTextInactive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Daily Attendance Report Section */}
        <View style={styles.reportSectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Daily Attendance Log</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{dayRecords.length}</Text>
            </View>
          </View>
          <View style={styles.punchModeTag}>
            <MaterialCommunityIcons 
              name={multipleTimeEntries ? "clock-fast" : "clock-check-outline"} 
              size={12} 
              color="#FF6900" 
              style={{ marginRight: 4 }} 
            />
            <Text style={styles.punchModeTagText}>{multipleTimeEntries ? 'Multi-Punch' : 'Standard'}</Text>
          </View>
        </View>

        {filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={36} color="#CBD5E1" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>
              {dayRecords.length === 0 ? 'No Attendance Records' : 'No Matching Records'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {dayRecords.length === 0
                ? `No one has marked attendance for ${date.toLocaleDateString()}`
                : 'Try adjusting the search or department filter'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {filteredRecords.map((item, index) => {
              const firstIn = item.punches.find((p) => p.type === 'IN')?.time || '--:--';
              const lastOut = [...item.punches].reverse().find((p) => p.type === 'OUT')?.time || '--:--';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recordCard}
                  activeOpacity={0.8}
                  onPress={() => setSelectedEmpPunches(item)}
                >
                  {/* Top row: Avatar + Name + Punch count badge */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.avatarCircle}>
                      <FontAwesome name="user" size={16} color="#FF6900" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10, overflow: 'hidden' }}>
                      <Text style={styles.empNameText} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                      <Text style={styles.empIdText} numberOfLines={1}>{item.employeeId}</Text>
                    </View>
                    <View style={styles.punchCountBadge}>
                      <MaterialCommunityIcons name="gesture-tap" size={11} color="#2563EB" style={{ marginRight: 3 }} />
                      <Text style={styles.punchCountBadgeText} numberOfLines={1}>
                        {item.punches.length} {item.punches.length === 1 ? 'Punch' : 'Punches'}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom row: Time In & Time Out Pills */}
                  <View style={styles.timingRow}>
                    <View style={styles.timePillIn}>
                      <MaterialCommunityIcons name="login" size={13} color="#059669" style={{ marginRight: 5 }} />
                      <View style={{ flex: 1, overflow: 'hidden' }}>
                        <Text style={styles.timePillLabelIn} numberOfLines={1}>TIME IN</Text>
                        <Text style={styles.timePillValueIn} numberOfLines={1} adjustsFontSizeToFit>{firstIn}</Text>
                      </View>
                    </View>

                    <View style={styles.timePillOut}>
                      <MaterialCommunityIcons name="logout" size={13} color="#C2410C" style={{ marginRight: 5 }} />
                      <View style={{ flex: 1, overflow: 'hidden' }}>
                        <Text style={styles.timePillLabelOut} numberOfLines={1}>TIME OUT</Text>
                        <Text style={styles.timePillValueOut} numberOfLines={1} adjustsFontSizeToFit>{lastOut}</Text>
                      </View>
                    </View>

                    <View style={styles.viewTimelineBtn}>
                      <FontAwesome name="chevron-right" size={11} color="#94A3B8" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail Multi-Punch Timeline Modal */}
      <Modal
        visible={!!selectedEmpPunches}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedEmpPunches(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>{selectedEmpPunches?.name}</Text>
                <Text style={styles.detailSubtitle}>
                  {selectedEmpPunches?.employeeId} • {selectedEmpPunches?.date}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeDetailBtn}
                onPress={() => setSelectedEmpPunches(null)}
              >
                <FontAwesome name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.punchTimelineList}>
              <Text style={styles.timelineSectionTitle}>Punches Log ({selectedEmpPunches?.punches.length})</Text>
              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {selectedEmpPunches?.punches.map((punch, pIdx) => (
                  <View key={punch.id} style={styles.timelineRow}>
                    <View style={[styles.punchTypeDot, punch.type === 'IN' ? styles.inDot : styles.outDot]}>
                      <MaterialCommunityIcons
                        name={punch.type === 'IN' ? 'login' : 'logout'}
                        size={13}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.punchTypeTitle}>
                        {punch.type === 'IN' ? 'Time In' : 'Time Out'}
                      </Text>
                      <Text style={styles.punchTimeSubtitle}>{punch.time}</Text>
                    </View>
                    <View style={[styles.punchTag, punch.type === 'IN' ? styles.inTag : styles.outTag]}>
                      <Text style={[styles.punchTagText, punch.type === 'IN' ? styles.inTagText : styles.outTagText]}>
                        Punch #{pIdx + 1}
                      </Text>
                    </View>
                    {/* Delete punch button */}
                    <TouchableOpacity
                      style={styles.deletePunchBtn}
                      onPress={() =>
                        handleDeletePunch(
                          selectedEmpPunches!.employeeId,
                          selectedEmpPunches!.date,
                          punch.id,
                          punch.time
                        )
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setSelectedEmpPunches(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
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
    color: '#FF6900',
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
    backgroundColor: '#FF6900',
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
    paddingBottom: 32,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  dateSelectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A192F',
  },
  changeDateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6900',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  metricIconWrapGreen: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconWrapBlue: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6900',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
  reportSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6900',
  },
  punchModeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  punchModeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  cardsList: {
    gap: 10,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  empIdText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  punchCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  punchCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePillIn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timePillLabelIn: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  timePillValueIn: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  timePillOut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timePillLabelOut: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
  },
  timePillValueOut: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  viewTimelineBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
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
  },
  closeDetailBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchTimelineList: {
    marginBottom: 16,
  },
  timelineSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  punchTypeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inDot: {
    backgroundColor: '#10B981',
  },
  outDot: {
    backgroundColor: '#F97316',
  },
  punchTypeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  punchTimeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  punchTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inTag: {
    backgroundColor: '#ECFDF5',
  },
  outTag: {
    backgroundColor: '#FFF7ED',
  },
  punchTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inTagText: {
    color: '#059669',
  },
  outTagText: {
    color: '#C2410C',
  },
  closeModalBtn: {
    backgroundColor: '#FF6900',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // ── New: Filter & Search styles ──────────────────────────────────────────
  filterContainer: {
    marginBottom: 14,
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
    padding: 0,
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterToggleBtnActive: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFF7ED',
  },
  filterToggleBtnHasFilter: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
  },
  filterBadgeCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  filterBadgeCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  activeFilterSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  activeFilterSummaryText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  expandableFilterCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterCardHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  filterResetLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  filterSectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#94A3B8',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  pillsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  compactPillActive: {
    borderColor: THEME_COLOR,
    backgroundColor: THEME_COLOR,
  },
  compactPillInactive: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  compactPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  compactPillTextActive: {
    color: '#FFFFFF',
  },
  compactPillTextInactive: {
    color: '#475569',
  },
  // ── Delete punch button ─────────────────────────────────────────────
  deletePunchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
});