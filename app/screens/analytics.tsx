import { formatLocalDate } from '@/utils/clockSync';
import { ThemedAlert } from '@/components/ThemedAlertProvider';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/context/AuthContext';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THEME_COLOR = '#FF6900';

type TimeRange = '7D' | '30D' | 'Month';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { attendanceRecords, enrolledEmployees, departments, leaves } = useAttendance();
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');

  // Generate date series based on time range
  const dateSeries = useMemo(() => {
    let days = 7;
    if (timeRange === '30D') {
      days = 30;
    } else if (timeRange === 'Month') {
      days = Math.max(1, new Date().getDate());
    }
    const list: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(formatLocalDate(d));
    }
    return list;
  }, [timeRange]);

  // Daily statistics for charts
  const dailyStats = useMemo(() => {
    const totalEmp = enrolledEmployees.length || 1;
    return dateSeries.map((dateStr) => {
      const records = attendanceRecords.filter((r) => r.date === dateStr);
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const halfDay = records.filter((r) => r.status === 'HALF_DAY').length;
      const onLeave = leaves.filter(
        (l) => l.startDate <= dateStr && l.endDate >= dateStr && l.status === 'APPROVED'
      ).length;
      const totalActive = present + late + halfDay;
      const rate = Math.round((totalActive / totalEmp) * 100);

      const dObj = new Date(dateStr);
      const dayLabel = dObj.toLocaleDateString('en-US', { weekday: 'narrow' });
      const dateNum = dObj.getDate();

      return {
        date: dateStr,
        dayLabel,
        dateNum,
        present,
        late,
        halfDay,
        onLeave,
        totalActive,
        rate: Math.min(100, rate),
      };
    });
  }, [dateSeries, attendanceRecords, enrolledEmployees, leaves]);

  // Overall KPI aggregates
  const overallKpis = useMemo(() => {
    const totalSlots = (enrolledEmployees.length || 1) * dateSeries.length;
    const allRecords = attendanceRecords.filter((r) => dateSeries.includes(r.date));
    const totalPresents = allRecords.length;
    const totalLates = allRecords.filter((r) => r.status === 'LATE').length;
    const totalOnTime = allRecords.filter((r) => r.status === 'PRESENT').length;

    const avgAttendanceRate = Math.round((totalPresents / totalSlots) * 100) || 0;
    const punctualityRate = totalPresents > 0 ? Math.round((totalOnTime / totalPresents) * 100) : 100;

    let totalPunches = 0;
    for (const r of allRecords) {
      totalPunches += r.punches.length;
    }

    return {
      avgAttendanceRate: Math.min(100, avgAttendanceRate),
      punctualityRate,
      totalPunches,
      totalRecords: totalPresents,
      totalLates,
    };
  }, [dateSeries, attendanceRecords, enrolledEmployees]);

  // Department breakdown heatmap
  const departmentStats = useMemo(() => {
    const list = departments.length > 0 ? departments : ['Engineering', 'HR & Admin', 'Design', 'Operations'];
    return list.map((dept) => {
      const deptEmployees = enrolledEmployees.filter((e) => e.department === dept);
      const empIds = new Set(deptEmployees.map((e) => e.employeeId));
      const deptRecords = attendanceRecords.filter(
        (r) => dateSeries.includes(r.date) && empIds.has(r.employeeId)
      );

      const possibleSlots = (deptEmployees.length || 1) * dateSeries.length;
      const actualPresents = deptRecords.length;
      const rate = possibleSlots > 0 ? Math.round((actualPresents / possibleSlots) * 100) : 0;
      const lateCount = deptRecords.filter((r) => r.status === 'LATE').length;
      const lateRate = actualPresents > 0 ? Math.round((lateCount / actualPresents) * 100) : 0;

      return {
        department: dept,
        totalEmployees: deptEmployees.length,
        attendanceRate: Math.min(100, rate),
        lateRate,
        totalRecords: actualPresents,
      };
    }).sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [departments, enrolledEmployees, attendanceRecords, dateSeries]);

  // Punctuality Leaderboard
  const leaderboard = useMemo(() => {
    return enrolledEmployees
      .map((emp) => {
        const empRecords = attendanceRecords.filter(
          (r) => dateSeries.includes(r.date) && r.employeeId === emp.employeeId
        );
        const presentCount = empRecords.filter((r) => r.status === 'PRESENT').length;
        const lateCount = empRecords.filter((r) => r.status === 'LATE').length;
        const total = empRecords.length;
        const score = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        return {
          employeeId: emp.employeeId,
          name: emp.name,
          department: emp.department,
          presentCount,
          lateCount,
          total,
          score,
        };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.score - a.score || b.presentCount - a.presentCount)
      .slice(0, 5);
  }, [enrolledEmployees, attendanceRecords, dateSeries]);

  const handleExportAnalytics = async () => {
    try {
      let csv = 'Metric,Value\n';
      csv += `Time Range,${timeRange === '7D' ? 'Last 7 Days' : timeRange === '30D' ? 'Last 30 Days' : 'This Month'}\n`;
      csv += `Average Attendance Rate,${overallKpis.avgAttendanceRate}%\n`;
      csv += `Punctuality Rate,${overallKpis.punctualityRate}%\n`;
      csv += `Total Punches Logged,${overallKpis.totalPunches}\n`;
      csv += `Total Late Arrivals,${overallKpis.totalLates}\n\n`;

      csv += 'Department,Employees,Attendance Rate %,Late Rate %\n';
      for (const d of departmentStats) {
        csv += `"${d.department}",${d.totalEmployees},${d.attendanceRate}%,${d.lateRate}%\n`;
      }

      csv += '\nTop Punctual Employees,ID,Department,On-Time Score %,On-Time Days\n';
      leaderboard.forEach((l, idx) => {
        csv += `${idx + 1}. "${l.name}","${l.employeeId}","${l.department}",${l.score}%,${l.presentCount}\n`;
      });

      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const fileUri = `${baseDir}attendance_analytics_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Attendance Analytics',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      ThemedAlert.alert('Export Error', msg, [{ text: 'OK' }], 'error');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Trends & punctuality intelligence</Text>
          <View style={styles.headerUnderline} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportAnalytics}
            activeOpacity={0.8}
          >
            <FontAwesome name="download" size={11} color="#FF6900" style={{ marginRight: 4 }} />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>

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
            <FontAwesome name="lock" size={12} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Time Range Selector */}
        <View style={styles.timeRangeBar}>
          {(
            [
              { id: '7D', label: 'Last 7 Days' },
              { id: '30D', label: 'Last 30 Days' },
              { id: 'Month', label: 'This Month' },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.rangePill, timeRange === t.id && styles.rangePillActive]}
              onPress={() => setTimeRange(t.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.rangePillText, timeRange === t.id && styles.rangePillTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top KPI Cards Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <MaterialCommunityIcons name="percent-outline" size={18} color="#059669" />
            </View>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{overallKpis.avgAttendanceRate}%</Text>
            <Text style={styles.kpiLabel}>Attendance Rate</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="clock-check-outline" size={18} color="#2563EB" />
            </View>
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{overallKpis.punctualityRate}%</Text>
            <Text style={styles.kpiLabel}>Punctuality Rate</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <MaterialCommunityIcons name="gesture-tap" size={18} color="#EA580C" />
            </View>
            <Text style={[styles.kpiValue, { color: '#EA580C' }]}>{overallKpis.totalPunches}</Text>
            <Text style={styles.kpiLabel}>Total Punches</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF2F2' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.kpiValue, { color: '#DC2626' }]}>{overallKpis.totalLates}</Text>
            <Text style={styles.kpiLabel}>Late Arrivals</Text>
          </View>
        </View>

        {/* Attendance Trend Chart Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="chart-bar" size={18} color="#FF6900" style={{ marginRight: 6 }} />
              <Text style={styles.sectionCardTitle}>Daily Attendance Trend</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
              <Text style={styles.legendText}>On Time</Text>
              <View style={[styles.legendDot, { backgroundColor: '#D97706', marginLeft: 8 }]} />
              <Text style={styles.legendText}>Late</Text>
            </View>
          </View>

          {/* Bar Chart Visualizer */}
          <View style={styles.chartContainer}>
            <View style={styles.barsRow}>
              {dailyStats.map((item) => {
                const barHeight = Math.max(8, (item.rate / 100) * 110);
                const lateRatio = item.totalActive > 0 ? item.late / item.totalActive : 0;
                const lateHeight = barHeight * lateRatio;
                const onTimeHeight = barHeight - lateHeight;

                return (
                  <View key={item.date} style={styles.barColumn}>
                    <Text style={styles.barRateText}>{item.rate}%</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFillLate, { height: lateHeight }]} />
                      <View style={[styles.barFillOnTime, { height: onTimeHeight }]} />
                    </View>
                    <Text style={styles.barDateLabel} numberOfLines={1}>
                      {timeRange === '7D' ? item.dayLabel : item.dateNum}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Department Attendance Heatmap */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="layers-outline" size={18} color="#7C3AED" style={{ marginRight: 6 }} />
              <Text style={styles.sectionCardTitle}>Department Breakdown</Text>
            </View>
            <Text style={styles.sectionCardMeta}>{departmentStats.length} Depts</Text>
          </View>

          <View style={{ marginTop: 10, gap: 12 }}>
            {departmentStats.map((dept) => (
              <View key={dept.department} style={styles.deptItem}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={styles.deptNameText}>{dept.department}</Text>
                  <Text style={styles.deptRateText}>
                    {dept.attendanceRate}% <Text style={{ color: '#94A3B8', fontSize: 10 }}>({dept.totalEmployees} staff)</Text>
                  </Text>
                </View>

                {/* Progress bar */}
                <View style={styles.deptBarTrack}>
                  <View
                    style={[
                      styles.deptBarFill,
                      {
                        width: `${dept.attendanceRate}%`,
                        backgroundColor:
                          dept.attendanceRate >= 85
                            ? '#059669'
                            : dept.attendanceRate >= 65
                              ? '#D97706'
                              : '#DC2626',
                      },
                    ]}
                  />
                </View>

                {dept.lateRate > 0 && (
                  <Text style={styles.deptLateMeta}>⚠️ {dept.lateRate}% late arrival frequency</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Punctuality Leaderboard */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="trophy-award" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.sectionCardTitle}>Punctuality Leaderboard</Text>
            </View>
            <Text style={styles.sectionCardMeta}>Top 5 On-Time</Text>
          </View>

          {leaderboard.length === 0 ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>No punctuality records recorded for this range.</Text>
            </View>
          ) : (
            <View style={{ marginTop: 8, gap: 8 }}>
              {leaderboard.map((item, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                return (
                  <View key={item.employeeId} style={styles.leaderRow}>
                    <Text style={styles.leaderRank}>{medal}</Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.leaderName}>{item.name}</Text>
                      <Text style={styles.leaderDept}>
                        {item.employeeId} · {item.department}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={styles.leaderScoreBadge}>
                        <Text style={styles.leaderScoreText}>{item.score}% On-Time</Text>
                      </View>
                      <Text style={styles.leaderDaysText}>{item.presentCount} days present</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0A192F', letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '500', marginTop: 1 },
  headerUnderline: { width: 32, height: 3, backgroundColor: '#FF6900', marginTop: 4, borderRadius: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  exportBtnText: { fontSize: 11, fontWeight: '800', color: '#FF6900' },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  lockBtnText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  scrollContent: { padding: 14, paddingBottom: 30 },
  timeRangeBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rangePill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 9,
  },
  rangePillActive: {
    backgroundColor: '#FF6900',
  },
  rangePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  rangePillTextActive: {
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionCardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sectionCardMeta: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  chartContainer: {
    height: 155,
    paddingTop: 10,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 4,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barRateText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
  },
  barTrack: {
    width: 14,
    height: 110,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFillOnTime: {
    width: '100%',
    backgroundColor: '#059669',
  },
  barFillLate: {
    width: '100%',
    backgroundColor: '#D97706',
  },
  barDateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  deptItem: {},
  deptNameText: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  deptRateText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  deptBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  deptBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  deptLateMeta: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 3,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  leaderRank: { fontSize: 16, fontWeight: '800', width: 28, textAlign: 'center' },
  leaderName: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  leaderDept: { fontSize: 11, color: '#64748B', marginTop: 1 },
  leaderScoreBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  leaderScoreText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  leaderDaysText: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});
