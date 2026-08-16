import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AppDateTimePicker from '@/components/AppDateTimePicker';

export default function DashboardScreen() {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [stats] = useState({
    markedToday: 1,
    totalEnrolled: 1,
  });

  const dailyReport = [
    { id: '1', slNo: '5', name: 'vishal saran', timeIn: '08:42:09 am', timeOut: '08:42:18 am' },
  ];

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
      const csvContent = "SI No.,Name,Time In,Time Out\n" + 
        dailyReport.map(r => `${r.slNo},${r.name},${r.timeIn},${r.timeOut}`).join("\n");
      
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDir) {
        Alert.alert('Error', 'Storage directory not available');
        return;
      }
      const fileUri = `${baseDir}attendance_report.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(fileUri);
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
        <Text style={styles.headerTitle}>Attendance Dashboard</Text>
        <View style={styles.headerUnderline} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Date Selector Dropdown Button */}
        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome name="calendar" size={16} color="#FF6900" style={{ marginRight: 10 }} />
            <Text style={styles.dateSelectorText}>{date.toDateString()}</Text>
          </View>
          <FontAwesome name="chevron-down" size={12} color="#9CA3AF" />
        </TouchableOpacity>

        <AppDateTimePicker
          visible={showPicker}
          value={date}
          mode="date"
          title="Select Attendance Date"
          themeColor="#FF6900"
          onChange={(newDate) => setDate(newDate)}
          onClose={() => setShowPicker(false)}
        />

        {/* Top Overview Cards */}
        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Marked</Text>
            <Text style={styles.metricValue}>{stats.markedToday}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Enrolled</Text>
            <Text style={styles.metricValue}>{stats.totalEnrolled}</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, { flex: 1 }]} onPress={exportToCSV} activeOpacity={0.8}>
            <FontAwesome name="download" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { flex: 1, backgroundColor: '#0A192F' }]} onPress={handleCalendarIntegration} activeOpacity={0.8}>
            <FontAwesome name="calendar-check-o" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Sync Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Attendance Report Section */}
        <Text style={styles.sectionTitle}>Daily Attendance Report</Text>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderText, { width: 50 }]}>SI No..</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Name</Text>
          <Text style={[styles.tableHeaderText, { width: 90 }]}>Time In</Text>
          <Text style={[styles.tableHeaderText, { width: 90 }]}>Time Out</Text>
        </View>

        <View style={styles.cardContainer}>
          {dailyReport.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <Text style={[styles.activityText, { width: 50, color: '#FF6900', fontWeight: '600' }]}>
                {item.slNo}
              </Text>
              <Text style={[styles.activityText, { flex: 1, fontWeight: '600', color: '#1F2937' }]}>
                {item.name}
              </Text>
              <Text style={[styles.activityText, { width: 90, color: '#4B5563' }]}>
                {item.timeIn}
              </Text>
              <Text style={[styles.activityText, { width: 90, color: '#4B5563' }]}>
                {item.timeOut}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <FontAwesome name="file-text" size={20} color="#FFFFFF" />
      </TouchableOpacity>
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A192F',
  },
  headerUnderline: {
    width: 35,
    height: 3,
    backgroundColor: '#FF6900',
    marginTop: 6,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#FF6900',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  dateSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A192F',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6900',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  metricLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityText: {
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6900',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});