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

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: '7D', label: 'Last 7 Days' },
  { id: '30D', label: 'Last 30 Days' },
  { id: 'Month', label: 'This Month' },
];

export default function AnalyticsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { attendanceRecords, enrolledEmployees, departments, leaves } = useAttendance();
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');

  const dateSeries = useMemo(() => {
    let days = 7;
    if (timeRange === '30D') days = 30;
    else if (timeRange === 'Month') days = Math.max(1, new Date().getDate());
    const list: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(formatLocalDate(d));
    }
    return list;
  }, [timeRange]);

  const dailyStats = useMemo(() => {
    const totalEmp = enrolledEmployees.length || 1;
    return dateSeries.map((dateStr) => {
      const records = attendanceRecords.filter((r) => r.date === dateStr);
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const halfDay = records.filter((r) => r.status === 'HALF_DAY').length;
      const totalActive = present + late + halfDay;
      const rate = Math.round((totalActive / totalEmp) * 100);
      const dObj = new Date(dateStr);
      const dayLabel = dObj.toLocaleDateString('en-US', { weekday: 'narrow' });
      const dateNum = dObj.getDate();
      return { date: dateStr, dayLabel, dateNum, present, late, halfDay, totalActive, rate: Math.min(100, rate) };
    });
  }, [dateSeries, attendanceRecords, enrolledEmployees]);

  const overallKpis = useMemo(() => {
    const totalSlots = (enrolledEmployees.length || 1) * dateSeries.length;
    const allRecords = attendanceRecords.filter((r) => dateSeries.includes(r.date));
    const totalPresents = allRecords.length;
    const totalLates = allRecords.filter((r) => r.status === 'LATE').length;
    const totalOnTime = allRecords.filter((r) => r.status === 'PRESENT').length;
    const avgAttendanceRate = Math.round((totalPresents / totalSlots) * 100) || 0;
    const punctualityRate = totalPresents > 0 ? Math.round((totalOnTime / totalPresents) * 100) : 100;
    let totalPunches = 0;
    for (const r of allRecords) totalPunches += r.punches.length;
    return {
      avgAttendanceRate: Math.min(100, avgAttendanceRate),
      punctualityRate,
      totalPunches,
      totalRecords: totalPresents,
      totalLates,
    };
  }, [dateSeries, attendanceRecords, enrolledEmployees]);

  const departmentStats = useMemo(() => {
    const list = departments.length > 0 ? departments : ['Engineering', 'HR & Admin', 'Design', 'Operations'];
    return list.map((dept) => {
      const deptEmployees = enrolledEmployees.filter((e) => e.department === dept);
      const empIds = new Set(deptEmployees.map((e) => e.employeeId));
      const deptRecords = attendanceRecords.filter((r) => dateSeries.includes(r.date) && empIds.has(r.employeeId));
      const possibleSlots = (deptEmployees.length || 1) * dateSeries.length;
      const actualPresents = deptRecords.length;
      const rate = possibleSlots > 0 ? Math.round((actualPresents / possibleSlots) * 100) : 0;
      const lateCount = deptRecords.filter((r) => r.status === 'LATE').length;
      const lateRate = actualPresents > 0 ? Math.round((lateCount / actualPresents) * 100) : 0;
      return { department: dept, totalEmployees: deptEmployees.length, attendanceRate: Math.min(100, rate), lateRate, totalRecords: actualPresents };
    }).sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [departments, enrolledEmployees, attendanceRecords, dateSeries]);

  const leaderboard = useMemo(() => {
    return enrolledEmployees.map((emp) => {
      const empRecords = attendanceRecords.filter((r) => dateSeries.includes(r.date) && r.employeeId === emp.employeeId);
      const presentCount = empRecords.filter((r) => r.status === 'PRESENT').length;
      const lateCount = empRecords.filter((r) => r.status === 'LATE').length;
      const total = empRecords.length;
      const score = total > 0 ? Math.round((presentCount / total) * 100) : 0;
      return { employeeId: emp.employeeId, name: emp.name, department: emp.department, presentCount, lateCount, total, score };
    }).filter((e) => e.total > 0).sort((a, b) => b.score - a.score || b.presentCount - a.presentCount).slice(0, 5);
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
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Attendance Analytics' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      ThemedAlert.alert('Export Error', msg, [{ text: 'OK' }], 'error');
    }
  };

  const getHealthColor = (rate: number) => (rate >= 85 ? '#10B981' : rate >= 65 ? '#F59E0B' : '#EF4444');
  const getHealthBg = (rate: number) => (rate >= 85 ? '#ECFDF5' : rate >= 65 ? '#FFFBEB' : '#FEF2F2');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Workforce attendance intelligence</Text>
          <View style={styles.headerUnderline} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportAnalytics} activeOpacity={0.8}>
            <FontAwesome name="download" size={11} color="#FF6900" style={{ marginRight: 4 }} />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.lockBtn}
            activeOpacity={0.8}
            onPress={() => {
              ThemedAlert.alert('Lock Screen', 'Lock Admin and return to Attendance Screen?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Lock', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
              ]);
            }}
          >
            <FontAwesome name="lock" size={12} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.timeRangeBar}>
          {TIME_RANGES.map((t) => (
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

        {/* KPI Summary Band */}
        <View style={styles.kpiBand}>
          <View style={styles.kpiBig}>
            <View style={styles.kpiBigIconWrap}>
              <MaterialCommunityIcons name="chart-donut" size={22} color="#FF6900" />
            </View>
            <Text style={styles.kpiBigValue}>{overallKpis.avgAttendanceRate}%</Text>
            <Text style={styles.kpiBigLabel}>Avg Attendance</Text>
            <View style={[styles.kpiHealthDot, { backgroundColor: getHealthColor(overallKpis.avgAttendanceRate) }]} />
          </View>
          <View style={styles.kpiBandDivider} />
          <View style={styles.kpiMiniStack}>
            <View style={styles.kpiMiniRow}>
              <View style={[styles.kpiMiniIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="clock-check-outline" size={14} color="#2563EB" />
              </View>
              <View>
                <Text style={[styles.kpiMiniValue, { color: '#2563EB' }]}>{overallKpis.punctualityRate}%</Text>
                <Text style={styles.kpiMiniLabel}>Punctuality</Text>
              </View>
            </View>
            <View style={styles.kpiMiniDivider} />
            <View style={styles.kpiMiniRow}>
              <View style={[styles.kpiMiniIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="gesture-tap" size={14} color="#EA580C" />
              </View>
              <View>
                <Text style={[styles.kpiMiniValue, { color: '#EA580C' }]}>{overallKpis.totalPunches}</Text>
                <Text style={styles.kpiMiniLabel}>Total Punches</Text>
              </View>
            </View>
            <View style={styles.kpiMiniDivider} />
            <View style={styles.kpiMiniRow}>
              <View style={[styles.kpiMiniIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="account-alert-outline" size={14} color="#DC2626" />
              </View>
              <View>
                <Text style={[styles.kpiMiniValue, { color: '#DC2626' }]}>{overallKpis.totalLates}</Text>
                <Text style={styles.kpiMiniLabel}>Late Arrivals</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Attendance Trend Chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.cardHeaderIcon}>
                <MaterialCommunityIcons name="chart-bar" size={15} color="#FF6900" />
              </View>
              <Text style={styles.cardTitle}>Daily Attendance Trend</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>On Time</Text>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B', marginLeft: 8 }]} />
              <Text style={styles.legendText}>Late</Text>
            </View>
          </View>
          <View style={styles.chartArea}>
            <View style={styles.chartGrid}>
              {[100, 75, 50, 25, 0].map((v) => (
                <View key={v} style={styles.gridLine}>
                  <Text style={styles.gridLabel}>{v}%</Text>
                  <View style={styles.gridLineBar} />
                </View>
              ))}
            </View>
            <View style={styles.barsRow}>
              {dailyStats.map((item) => {
                const barMaxH = 110;
                const barH = Math.max(4, (item.rate / 100) * barMaxH);
                const lateRatio = item.totalActive > 0 ? item.late / item.totalActive : 0;
                const lateH = barH * lateRatio;
                const onTimeH = barH - lateH;
                return (
                  <View key={item.date} style={styles.barCol}>
                    {item.rate > 0 && <Text style={styles.barRateLbl}>{item.rate}%</Text>}
                    <View style={[styles.barTrack, { height: barMaxH }]}>
                      <View style={[styles.barSegLate, { height: lateH }]} />
                      <View style={[styles.barSegOnTime, { height: onTimeH }]} />
                    </View>
                    <Text style={styles.barDateLbl}>{timeRange === '7D' ? item.dayLabel : item.dateNum}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Department Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#F5F3FF' }]}>
                <MaterialCommunityIcons name="layers-outline" size={15} color="#7C3AED" />
              </View>
              <Text style={styles.cardTitle}>Department Breakdown</Text>
            </View>
            <View style={styles.deptCountBadge}>
              <Text style={styles.deptCountText}>{departmentStats.length} Dept</Text>
            </View>
          </View>
          <View style={{ gap: 14, marginTop: 6 }}>
            {departmentStats.map((dept, idx) => {
              const barColor = getHealthColor(dept.attendanceRate);
              const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
              return (
                <View key={dept.department}>
                  <View style={styles.deptRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {rankLabel && <Text style={styles.deptRank}>{rankLabel}</Text>}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deptName}>{dept.department}</Text>
                        <Text style={styles.deptMeta}>{dept.totalEmployees} staff · {dept.totalRecords} records</Text>
                      </View>
                    </View>
                    <View style={[styles.deptRateBadge, { backgroundColor: getHealthBg(dept.attendanceRate) }]}>
                      <Text style={[styles.deptRateText, { color: barColor }]}>{dept.attendanceRate}%</Text>
                    </View>
                  </View>
                  <View style={styles.deptBarTrack}>
                    <View style={[styles.deptBarFill, { width: `${dept.attendanceRate}%`, backgroundColor: barColor }]} />
                  </View>
                  {dept.lateRate > 0 && (
                    <View style={styles.deptLateBadge}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={10} color="#D97706" style={{ marginRight: 3 }} />
                      <Text style={styles.deptLateText}>{dept.lateRate}% late frequency</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Punctuality Leaderboard */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#FFFBEB' }]}>
                <MaterialCommunityIcons name="trophy" size={15} color="#F59E0B" />
              </View>
              <Text style={styles.cardTitle}>Punctuality Leaderboard</Text>
            </View>
            <Text style={styles.leaderSubtitle}>Top 5 On-Time</Text>
          </View>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="podium-silver" size={36} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>No data for this period</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {leaderboard.map((item, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                const isTop = idx === 0;
                return (
                  <View key={item.employeeId} style={[styles.leaderRow, isTop && styles.leaderRowTop]}>
                    <Text style={[styles.leaderMedal, isTop && { fontSize: 20 }]}>{medal}</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.leaderName, isTop && { color: '#FF6900' }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.leaderMeta}>{item.employeeId} · {item.department}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.scoreBadge, { backgroundColor: isTop ? '#FFF7ED' : '#F8FAFC', borderColor: isTop ? '#FFEDD5' : '#E2E8F0' }]}>
                        <Text style={[styles.scoreText, { color: isTop ? '#FF6900' : '#059669' }]}>{item.score}%</Text>
                      </View>
                      <Text style={styles.leaderDays}>{item.presentCount}d present</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Summary Footer */}
        <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>PERIOD SUMMARY</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[
              { label: 'Days Tracked', value: dateSeries.length },
              { label: 'Enrolled', value: enrolledEmployees.length },
              { label: 'Records', value: overallKpis.totalRecords },
              { label: 'Late Count', value: overallKpis.totalLates },
            ].map((s) => (
              <View key={s.label} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>{s.value}</Text>
                <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
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
  scrollContent: { padding: 14, paddingBottom: 36, gap: 12 },
  timeRangeBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rangePill: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 9 },
  rangePillActive: { backgroundColor: '#FF6900' },
  rangePillText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  rangePillTextActive: { color: '#FFFFFF' },
  kpiBand: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiBig: {
    flex: 1.1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBF7',
    gap: 4,
  },
  kpiBigIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiBigValue: { fontSize: 34, fontWeight: '900', color: '#FF6900', letterSpacing: -1 },
  kpiBigLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  kpiHealthDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  kpiBandDivider: { width: 1, backgroundColor: '#F1F5F9' },
  kpiMiniStack: { flex: 1, padding: 14 },
  kpiMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  kpiMiniIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiMiniValue: { fontSize: 15, fontWeight: '800' },
  kpiMiniLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  kpiMiniDivider: { height: 1, backgroundColor: '#F1F5F9' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 3 },
  legendText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  chartArea: { height: 160 },
  chartGrid: {
    position: 'absolute',
    top: 0,
    left: 32,
    right: 0,
    bottom: 22,
    justifyContent: 'space-between',
  },
  gridLine: { flexDirection: 'row', alignItems: 'center' },
  gridLabel: { fontSize: 9, color: '#CBD5E1', fontWeight: '600', width: 24, textAlign: 'right', marginRight: 6 },
  gridLineBar: { flex: 1, height: 1, backgroundColor: '#F1F5F9' },
  barsRow: {
    position: 'absolute',
    left: 62,
    right: 0,
    bottom: 22,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barCol: { alignItems: 'center', flex: 1 },
  barRateLbl: { fontSize: 8, fontWeight: '700', color: '#94A3B8', marginBottom: 2 },
  barTrack: {
    width: 13,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barSegOnTime: { width: '100%', backgroundColor: '#10B981' },
  barSegLate: { width: '100%', backgroundColor: '#F59E0B' },
  barDateLbl: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginTop: 5 },
  deptCountBadge: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  deptCountText: { fontSize: 10, fontWeight: '800', color: '#7C3AED' },
  deptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  deptRank: { fontSize: 14, marginRight: 6 },
  deptName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  deptMeta: { fontSize: 10, color: '#94A3B8', fontWeight: '500', marginTop: 1 },
  deptRateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  deptRateText: { fontSize: 12, fontWeight: '800' },
  deptBarTrack: { height: 7, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  deptBarFill: { height: '100%', borderRadius: 4 },
  deptLateBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  deptLateText: { fontSize: 10, color: '#D97706', fontWeight: '600' },
  leaderSubtitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  leaderRowTop: { backgroundColor: '#FFFBF7', borderColor: '#FFEDD5' },
  leaderMedal: { fontSize: 18, width: 26, textAlign: 'center' },
  leaderName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  leaderMeta: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  scoreText: { fontSize: 11, fontWeight: '800' },
  leaderDays: { fontSize: 10, color: '#94A3B8', marginTop: 3 },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyStateText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
});

