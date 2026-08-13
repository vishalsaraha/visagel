import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';

export default function AttendanceScreen() {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  // Dummy attendance data matching your dashboard reference
  const attendanceList = [
    { id: '1', serialNo: 'BR-001', name: 'Ravi Kiran', timeIn: '09:30 AM', timeOut: '05:30 PM' },
    { id: '2', serialNo: 'BR-001', name: 'Prabhu Raj Manoj', timeIn: '09:30 AM', timeOut: '05:30 PM' },
    { id: '3', serialNo: 'BR-001', name: 'Daniel Defoe', timeIn: '09:30 AM', timeOut: '05:30 PM' },
    { id: '4', serialNo: 'BR-001', name: 'Prabhu Rajashha...', timeIn: '09:30 AM', timeOut: '05:30 PM' },
    { id: '5', serialNo: 'BR-001', name: 'Ravi Kiran', timeIn: '09:30 AM', timeOut: '05:30 PM' },
    { id: '6', serialNo: 'BR-001', name: 'Ravi Kiran', timeIn: '09:30 AM', timeOut: '05:30 PM' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Attendance Dashboard</Text>
        <View style={styles.headerUnderline} />
      </View>

      {/* Daily / Monthly Toggle Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'daily' && styles.activeTabButton]}
          onPress={() => setActiveTab('daily')}
        >
          <Text style={[styles.tabText, activeTab === 'daily' && styles.activeTabText]}>
            DAILY
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'monthly' && styles.activeTabButton]}
          onPress={() => setActiveTab('monthly')}
        >
          <Text style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>
            MONTHLY
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Report Subheader */}
        <Text style={styles.sectionSubTitle}>Daily Attendance Report</Text>

        {/* Date Selector */}
        <View style={styles.dateSelectorRow}>
          <Text style={styles.selectDateLabel}>Select Date</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>Friday, Sept 3, 2021</Text>
          </View>
        </View>

        {/* Stats Cards (Marked & Enrolled) */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statCardTitle}>Marked</Text>
            <Text style={styles.statCardNumber}>3</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardTitle}>Enrolled</Text>
            <Text style={styles.statCardNumber}>26</Text>
          </View>
        </View>

        {/* Attendance List Section */}
        <Text style={styles.listSectionTitle}>Attendance List</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Serial No.</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Name</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Time In</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'right' }]}>Time Out</Text>
        </View>

        {attendanceList.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCellBold, { flex: 1.2 }]}>{item.serialNo}</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.timeIn}</Text>
            <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>{item.timeOut}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fabButton} activeOpacity={0.8}>
        <FontAwesome name="share-alt" size={20} color="#FFFFFF" />
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
    fontSize: 22,
    fontWeight: '700',
    color: '#0A192F',
  },
  headerUnderline: {
    width: 30,
    height: 3,
    backgroundColor: '#FF6900',
    marginTop: 6,
    borderRadius: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: '#FF6900',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#FF6900',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 90, // extra space for floating action button & bottom tab bar
  },
  sectionSubTitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  selectDateLabel: {
    fontSize: 14,
    color: '#2563EB',
    marginRight: 12,
    fontWeight: '500',
  },
  dateBadge: {
    backgroundColor: '#FF6900',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dateBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statCardTitle: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 6,
  },
  statCardNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableCellBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  tableCell: {
    fontSize: 13,
    color: '#4B5563',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 80, // sits comfortably above the 60px bottom navigation bar
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6900',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});