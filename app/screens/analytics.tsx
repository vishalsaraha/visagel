import { formatLocalDate } from '@/utils/clockSync';
import { ThemedAlert } from '@/components/ThemedAlertProvider';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/context/AuthContext';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Professional White Theme Palette ─────────────────────────────────────────
const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  accent: '#FF6900',
  accentSoft: 'rgba(255, 105, 0, 0.1)',
  blue: '#2563EB',
  blueSoft: 'rgba(37, 99, 235, 0.1)',
  green: '#059669',
  greenSoft: 'rgba(5, 150, 105, 0.1)',
  amber: '#D97706',
  amberSoft: 'rgba(217, 119, 6, 0.1)',
  red: '#DC2626',
  redSoft: 'rgba(220, 38, 38, 0.1)',
  purple: '#7C3AED',
  purpleSoft: 'rgba(124, 58, 237, 0.1)',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
};

type TimeRange = '7D' | '30D' | 'Month';
const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: '7D', label: 'Last 7 Days' },
  { id: '30D', label: 'Last 30 Days' },
  { id: 'Month', label: 'This Month' },
];

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={s.sectionTitle}>
      <View style={s.sectionIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={15} color={C.accent} />
      </View>
      <Text style={s.sectionTitleText}>{label}</Text>
    </View>
  );
}

function KpiTile({
  value,
  label,
  sub,
  icon,
  accent,
  soft,
}: {
  value: string | number;
  label: string;
  sub?: string;
  icon: string;
  accent: string;
  soft: string;
}) {
  return (
    <View style={s.kpiTile}>
      <View style={[s.kpiIcon, { backgroundColor: soft }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={accent} />
      </View>
      <Text style={[s.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { attendanceRecords, enrolledEmployees, departments } = useAttendance();
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
    return list
      .map((dept) => {
        const deptEmployees = enrolledEmployees.filter((e) => e.department === dept);
        const empIds = new Set(deptEmployees.map((e) => e.employeeId));
        const deptRecords = attendanceRecords.filter((r) => dateSeries.includes(r.date) && empIds.has(r.employeeId));
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
      })
      .sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [departments, enrolledEmployees, attendanceRecords, dateSeries]);

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
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const fileUri = `${baseDir}attendance_analytics_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Analytics' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      ThemedAlert.alert('Export Error', msg, [{ text: 'OK' }], 'error');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>WORKFORCE REPORTING</Text>
          <Text style={s.headerTitle}>Analytics</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.iconBtn} onPress={handleExportAnalytics} activeOpacity={0.75}>
            <FontAwesome5 name="file-export" size={13} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: C.redSoft, backgroundColor: C.redSoft }]}
            activeOpacity={0.75}
            onPress={() => {
              ThemedAlert.alert('Lock Screen', 'Lock Admin and return to Attendance Screen?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Lock',
                  style: 'destructive',
                  onPress: () => {
                    logout();
                    router.replace('/');
                  },
                },
              ]);
            }}
          >
            <FontAwesome5 name="lock" size={12} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Time Range Selector ── */}
        <View style={s.timeBar}>
          {TIME_RANGES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[s.timePill, timeRange === t.id && s.timePillActive]}
              onPress={() => setTimeRange(t.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.timePillText, timeRange === t.id && s.timePillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Executive Attendance Summary Card ── */}
        <View style={s.card}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>AVERAGE ATTENDANCE</Text>
              <Text style={s.heroValue}>
                {overallKpis.avgAttendanceRate}
                <Text style={s.heroUnit}>%</Text>
              </Text>
            </View>
            <View
              style={[
                s.statusBadge,
                {
                  backgroundColor:
                    overallKpis.avgAttendanceRate >= 80 ? C.greenSoft : C.amberSoft,
                },
              ]}
            >
              <Text
                style={[
                  s.statusBadgeText,
                  {
                    color:
                      overallKpis.avgAttendanceRate >= 80 ? C.green : C.amber,
                  },
                ]}
              >
                {overallKpis.avgAttendanceRate >= 80 ? 'Optimal' : 'Needs Attention'}
              </Text>
            </View>
          </View>

          {/* Clean Progress Indicator Bar */}
          <View style={s.progressBarTrack}>
            <View
              style={[
                s.progressBarFill,
                {
                  width: `${overallKpis.avgAttendanceRate}%`,
                  backgroundColor:
                    overallKpis.avgAttendanceRate >= 80 ? C.green : C.accent,
                },
              ]}
            />
          </View>

          <View style={s.heroMetricsRow}>
            <View style={s.heroMetricCol}>
              <Text style={s.heroMetricValue}>{dateSeries.length}</Text>
              <Text style={s.heroMetricLabel}>Days Monitored</Text>
            </View>
            <View style={s.heroMetricDivider} />
            <View style={s.heroMetricCol}>
              <Text style={s.heroMetricValue}>{enrolledEmployees.length}</Text>
              <Text style={s.heroMetricLabel}>Total Staff</Text>
            </View>
            <View style={s.heroMetricDivider} />
            <View style={s.heroMetricCol}>
              <Text style={s.heroMetricValue}>{overallKpis.totalRecords}</Text>
              <Text style={s.heroMetricLabel}>Present Logs</Text>
            </View>
          </View>
        </View>

        {/* ── KPI Grid ── */}
        <View style={s.kpiGrid}>
          <KpiTile
            value={`${overallKpis.punctualityRate}%`}
            label="Punctuality"
            sub="On-time arrival rate"
            icon="clock-check-outline"
            accent={C.blue}
            soft={C.blueSoft}
          />
          <KpiTile
            value={overallKpis.totalPunches}
            label="Total Punches"
            sub="Logged across period"
            icon="gesture-tap"
            accent={C.accent}
            soft={C.accentSoft}
          />
          <KpiTile
            value={overallKpis.totalLates}
            label="Late Arrivals"
            sub="Recorded late punches"
            icon="account-alert-outline"
            accent={C.red}
            soft={C.redSoft}
          />
          <KpiTile
            value={departmentStats.length}
            label="Departments"
            sub="Active operational units"
            icon="office-building"
            accent={C.purple}
            soft={C.purpleSoft}
          />
        </View>

        {/* ── Department Attendance Breakdown Table ── */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <SectionTitle icon="layers-outline" label="Department Breakdown" />
            <Text style={s.headerMeta}>{departmentStats.length} departments</Text>
          </View>

          <View style={s.deptList}>
            {departmentStats.map((dept, idx) => (
              <View
                key={dept.department}
                style={[s.deptRow, idx === departmentStats.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={s.deptInfoRow}>
                  <View style={s.deptNameWrap}>
                    <Text style={s.deptNameText}>{dept.department}</Text>
                    <Text style={s.deptSubText}>
                      {dept.totalEmployees} employees · {dept.totalRecords} present records
                    </Text>
                  </View>
                  <View style={s.deptRatesWrap}>
                    <Text style={s.deptRateText}>{dept.attendanceRate}%</Text>
                    {dept.lateRate > 0 ? (
                      <Text style={s.deptLateText}>{dept.lateRate}% late</Text>
                    ) : (
                      <Text style={s.deptOnTimeText}>100% on time</Text>
                    )}
                  </View>
                </View>

                {/* Horizontal clean progress bar */}
                <View style={s.deptBarTrack}>
                  <View
                    style={[
                      s.deptBarFill,
                      {
                        width: `${dept.attendanceRate}%`,
                        backgroundColor:
                          dept.attendanceRate >= 80 ? C.green : dept.attendanceRate >= 60 ? C.amber : C.red,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Period Summary ── */}
        <View style={[s.card, s.summaryCard]}>
          <View style={s.summaryHeader}>
            <MaterialCommunityIcons name="information-outline" size={15} color={C.textSecondary} />
            <Text style={s.summaryTitle}>PERIOD SUMMARY</Text>
          </View>
          <View style={s.summaryGrid}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: C.blue }]}>{dateSeries.length}</Text>
              <Text style={s.summaryLabel}>Days Tracked</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: C.purple }]}>{enrolledEmployees.length}</Text>
              <Text style={s.summaryLabel}>Total Enrolled</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: C.green }]}>{overallKpis.totalRecords}</Text>
              <Text style={s.summaryLabel}>Attendance Logs</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: C.red }]}>{overallKpis.totalLates}</Text>
              <Text style={s.summaryLabel}>Late Count</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: C.accent,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  timeBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  timePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  timePillActive: {
    backgroundColor: C.accent,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
  },
  timePillTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSecondary,
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: '800',
    color: C.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: C.accent,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: C.borderLight,
    borderRadius: 4,
    marginVertical: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  heroMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  heroMetricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
  },
  heroMetricLabel: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.border,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  deptList: {
    gap: 12,
  },
  deptRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 8,
  },
  deptInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deptNameWrap: {
    flex: 1,
  },
  deptNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  deptSubText: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  deptRatesWrap: {
    alignItems: 'flex-end',
  },
  deptRateText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  deptLateText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.amber,
    marginTop: 2,
  },
  deptOnTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.green,
    marginTop: 2,
  },
  deptBarTrack: {
    height: 6,
    backgroundColor: C.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  deptBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSecondary,
    letterSpacing: 0.8,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 10,
    color: C.textSecondary,
    marginTop: 2,
  },
});
