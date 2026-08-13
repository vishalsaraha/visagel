import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function AttendanceScreen() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<{ name: string; time: string; type: string } | null>(null);
  
  // Expo Camera permission hook
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // Auto-request camera permissions on mount for wall-mounted kiosk use
  useEffect(() => {
    (async () => {
      if (!permission || !permission.granted) {
        await requestPermission();
      }
    })();
  }, [permission]);

  // Simulate automatic face scan loop for a wall-mounted kiosk
  useEffect(() => {
    const scanTimer = setTimeout(() => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      const secondsStr = seconds < 10 ? '0' + seconds : seconds;
      
      setLastScanned({
        name: 'Ravi Kiran (BR-001)',
        time: `${hours}:${minutesStr}:${secondsStr} ${ampm}`,
        type: 'Time In Verified',
      });
    }, 3000);

    return () => clearTimeout(scanTimer);
  }, []);

  // Live clock simulation
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      const secondsStr = seconds < 10 ? '0' + seconds : seconds;
      setCurrentTime(`${hours}:${minutesStr}:${secondsStr} ${ampm}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header Title with Old Style Underline and Admin Button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Attendance Kiosk</Text>
            <View style={styles.headerUnderline} />
          </View>
          <TouchableOpacity 
            style={styles.adminButton}
            activeOpacity={0.8}
            onPress={() => router.push('/screens/enrolment')}
          >
            <FontAwesome name="lock" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.adminButtonText}>Admin</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scrollContent}>
        
        {/* Redesigned Sleek Digital Clock & Calendar Banner */}
        <View style={styles.clockBannerCard}>
          <View style={styles.clockBannerTopRow}>
            <View style={styles.dateBadgePill}>
              <MaterialCommunityIcons name="calendar-blank" size={14} color="#FF6900" style={{ marginRight: 6 }} />
              <Text style={styles.dateBadgeText}>Thursday, 13 August 2026</Text>
            </View>
            <View style={styles.liveIndicatorDot} />
          </View>

          <View style={styles.clockBannerMainRow}>
            <MaterialCommunityIcons name="clock-outline" size={28} color="#FF6900" style={{ marginRight: 12 }} />
            <Text style={styles.heroDigitalTime}>{currentTime || '8:43:40 am'}</Text>
          </View>

          {/* Large Wall-Mounted Camera Viewport with absolute overlay matching SDK requirements */}
          <View style={styles.cameraWrapper}>
            <CameraView 
              style={styles.expoCameraView} 
              facing="front"
              ref={cameraRef}
            />
            <View style={styles.cameraOverlayFrame} pointerEvents="none">
              <ActivityIndicator size="small" color="#FF6900" style={{ marginBottom: 4 }} />
              <Text style={styles.scannerActiveText}>Stand in front to scan...</Text>
            </View>
          </View>
        </View>

        {/* Highly Visible Verification Result & Time Banner */}
        <View style={styles.summaryCard}>
          {lastScanned ? (
            <View style={styles.scannedResultBox}>
              <FontAwesome name="check-circle" size={32} color="#059669" style={{ marginRight: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scannedNameText}>{lastScanned.name}</Text>
                <Text style={styles.scannedTypeBadge}>{lastScanned.type}</Text>
                <Text style={styles.scannedTimeText}>{lastScanned.time}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyScanBox}>
              <Text style={styles.emptyScanText}>Position face within frame to automatically register attendance.</Text>
            </View>
          )}
        </View>

      </View>
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6900',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  adminButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
  },
  clockBannerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  clockBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  dateBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C2410C',
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  clockBannerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  heroDigitalTime: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  cameraWrapper: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FF6900',
    backgroundColor: '#000000',
    position: 'relative',
  },
  expoCameraView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cameraOverlayFrame: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerActiveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  scannedResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  scannedNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065F46',
  },
  scannedTypeBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scannedTimeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#065F46',
    marginTop: 4,
  },
  emptyScanBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyScanText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});