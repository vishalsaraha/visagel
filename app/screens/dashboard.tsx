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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAttendance, EmployeeAttendance } from '@/context/AttendanceContext';
import * as Calendar from 'expo-calendar';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME_COLOR = '#FF6900';

export default function DashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { attendanceRecords, multipleTimeEntries, recordPunch } = useAttendance();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [selectedEmpPunches, setSelectedEmpPunches] = useState<EmployeeAttendance | null>(null);

  const selectedDateStr = date.toISOString().split('T')[0];
  const dayRecords = attendanceRecords.filter((r) => r.date === selectedDateStr);

  const stats = {
    markedToday: dayRecords.length,
    totalEnrolled: Math.max(dayRecords.length, 2),
  };

  const handleCalendarIntegration = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        Alert.alert('Calendar Success', `Found ${calendars.length} calendar(s) on device.`);
      } else {
        Alert.alert('Permission Denied', 'Calendar permission is required to sync events.');
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown calendar error occurred';
      Alert.alert('Calendar Error', errMsg);
    }
  };

  const exportToCSV = async () => {
    try {
      if (dayRecords.length === 0) {
        Alert.alert('Notice', 'No attendance records available for this date to export.');
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
        Alert.alert('Error', 'Storage directory not available');
        return;
      }
      const fileUri = `${baseDir}attendance_report_${selectedDateStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Daily Attendance Report',
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown export error occurred';
      Alert.alert('Export Failed', errMsg);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Title */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Attendance Report</Text>
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
            <FontAwesome name="download" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { flex: 1, backgroundColor: '#0A192F' }]} onPress={handleCalendarIntegration} activeOpacity={0.8}>
            <FontAwesome name="calendar-check-o" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Sync Calendar</Text>
          </TouchableOpacity>
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

        {dayRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={36} color="#CBD5E1" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>No Attendance Records</Text>
            <Text style={styles.emptySubtitle}>No one has marked attendance for {date.toLocaleDateString()}</Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {dayRecords.map((item, index) => {
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
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.empNameText}>{item.name}</Text>
                      <Text style={styles.empIdText}>{item.employeeId}</Text>
                    </View>
                    <View style={styles.punchCountBadge}>
                      <MaterialCommunityIcons name="gesture-tap" size={11} color="#2563EB" style={{ marginRight: 3 }} />
                      <Text style={styles.punchCountBadgeText}>
                        {item.punches.length} {item.punches.length === 1 ? 'Punch' : 'Punches'}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom row: Time In & Time Out Pills */}
                  <View style={styles.timingRow}>
                    <View style={styles.timePillIn}>
                      <MaterialCommunityIcons name="login" size={13} color="#059669" style={{ marginRight: 5 }} />
                      <View>
                        <Text style={styles.timePillLabelIn}>TIME IN</Text>
                        <Text style={styles.timePillValueIn}>{firstIn}</Text>
                      </View>
                    </View>

                    <View style={styles.timePillOut}>
                      <MaterialCommunityIcons name="logout" size={13} color="#C2410C" style={{ marginRight: 5 }} />
                      <View>
                        <Text style={styles.timePillLabelOut}>TIME OUT</Text>
                        <Text style={styles.timePillValueOut}>{lastOut}</Text>
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
                </View>
              ))}
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
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
});