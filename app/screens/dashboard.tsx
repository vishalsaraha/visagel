import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';

export default function DashboardScreen() {
  const [stats] = useState({
    totalEnrolled: 26,
    presentToday: 23,
    absentToday: 3,
    attendanceRate: '88.5%',
  });

  const recentActivity = [
    { id: '1', name: 'Ravi Kiran', time: '09:30 AM', status: 'Present' },
    { id: '2', name: 'Prabhu Raj Manoj', time: '09:32 AM', status: 'Present' },
    { id: '3', name: 'Daniel Defoe', time: '09:45 AM', status: 'Present' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <View style={styles.headerUnderline} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Overview Cards */}
        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 105, 0, 0.1)' }]}>
              <FontAwesome name="users" size={20} color="#FF6900" />
            </View>
            <Text style={styles.metricValue}>{stats.totalEnrolled}</Text>
            <Text style={styles.metricLabel}>Total Enrolled</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <FontAwesome name="check-circle" size={20} color="#10B981" />
            </View>
            <Text style={styles.metricValue}>{stats.presentToday}</Text>
            <Text style={styles.metricLabel}>Present Today</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <FontAwesome name="times-circle" size={20} color="#EF4444" />
            </View>
            <Text style={styles.metricValue}>{stats.absentToday}</Text>
            <Text style={styles.metricLabel}>Absent Today</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <FontAwesome name="pie-chart" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.metricValue}>{stats.attendanceRate}</Text>
            <Text style={styles.metricLabel}>Attendance Rate</Text>
          </View>
        </View>

        {/* Recent Activity Section */}
        <Text style={styles.sectionTitle}>Recent Check-Ins</Text>

        <View style={styles.cardContainer}>
          {recentActivity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityLeft}>
                <View style={styles.avatarCircle}>
                  <FontAwesome name="user" size={14} color="#6B7280" />
                </View>
                <View>
                  <Text style={styles.activityName}>{item.name}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 90,
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 12,
  },
  cardContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  activityTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
});