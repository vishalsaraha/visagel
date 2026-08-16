import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAttendance } from '@/context/AttendanceContext';
import AuthPasswordModal from '@/components/AuthPasswordModal';

type ScanPhase = 'idle' | 'detecting' | 'matching' | 'verified' | 'failed';

export default function AttendanceScreen() {
  const router = useRouter();
  const { verifyPassword, isAuthenticated } = useAuth();
  const { recordPunch, multipleTimeEntries, attendanceRecords } = useAttendance();
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [lastScanned, setLastScanned] = useState<{
    name: string;
    time: string;
    type: string;
    punchCount?: number;
  } | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // Animated values for face detection bounding box
  const boxOpacity = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(new Animated.Value(0.85)).current;
  const cornerOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      if (!permission || !permission.granted) await requestPermission();
    })();
  }, [permission, requestPermission]);

  useEffect(() => {
    const now = new Date();
    setCurrentDateStr(now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
  }, []);

  // Auto-trigger scan after 1.5s on mount
  useEffect(() => {
    const t = setTimeout(() => triggerFaceScan(), 1500);
    return () => clearTimeout(t);
  }, []);

  // --- Bounding box helpers ---
  const showBox = (phase: Exclude<ScanPhase, 'idle'>) => {
    setScanPhase(phase);
    Animated.parallel([
      Animated.timing(boxOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(boxScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(cornerOpacity, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }),
    ]).start();
  };

  const hideBox = () => {
    Animated.parallel([
      Animated.timing(boxOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(cornerOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { boxScale.setValue(0.85); setScanPhase('idle'); });
  };

  const triggerFaceScan = () => {
    if (scanPhase !== 'idle') return;
    progressAnim.setValue(0);
    showBox('detecting');
    setTimeout(() => {
      setScanPhase('matching');
      Animated.timing(progressAnim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    }, 900);
    setTimeout(() => {
      setScanPhase('verified');
      const res = recordPunch('BR-001', 'Ravi Kiran');
      const existing = attendanceRecords.find((r) => r.employeeId === 'BR-001');
      const count = (existing?.punches.length || 0) + (res.isNewPunch ? 1 : 0);
      setLastScanned({ name: 'Ravi Kiran', time: res.punch.time, type: res.type === 'IN' ? 'Time In' : 'Time Out', punchCount: count });
      setTimeout(() => hideBox(), 1800);
    }, 1900);
  };

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes(), s = now.getSeconds();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setCurrentTime(`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`);
    };
    updateClock();
    const iv = setInterval(updateClock, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleAdminPress = () => {
    if (isAuthenticated) router.push('/screens/enrolment');
    else setAuthModalVisible(true);
  };

  // Phase-driven box colour and label
  const boxColor =
    scanPhase === 'verified' ? '#10B981' :
    scanPhase === 'failed'   ? '#EF4444' :
    scanPhase === 'matching' ? '#F59E0B' : '#FF6900';

  const phaseLabel =
    scanPhase === 'detecting' ? 'Detecting face...' :
    scanPhase === 'matching'  ? 'Matching identity...' :
    scanPhase === 'verified'  ? 'Identity verified' :
    scanPhase === 'failed'    ? 'Not recognised' : 'Look at camera';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Attendance</Text>
            <View style={styles.headerUnderline} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDotInner} />
              <Text style={styles.liveDotText}>LIVE</Text>
            </View>
            <TouchableOpacity style={styles.adminButton} activeOpacity={0.8} onPress={handleAdminPress}>
              <FontAwesome name="lock" size={12} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.adminButtonText}>Admin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.scrollContent}>
        {/* Date + Clock + Mode row */}
        <View style={styles.topInfoRow}>
          <View style={styles.dateBadgePill}>
            <MaterialCommunityIcons name="calendar-blank" size={12} color="#FF6900" style={{ marginRight: 4 }} />
            <Text style={styles.dateBadgeText}>{currentDateStr || 'Today'}</Text>
          </View>
          <View style={styles.clockPill}>
            <MaterialCommunityIcons name="clock-outline" size={13} color="#0F172A" style={{ marginRight: 4 }} />
            <Text style={styles.clockText}>{currentTime || '--:--:-- AM'}</Text>
          </View>
          <View style={[styles.modeBadge, { borderColor: multipleTimeEntries ? '#BAE6FD' : '#BBF7D0' }]}>
            <MaterialCommunityIcons
              name={multipleTimeEntries ? 'clock-fast' : 'clock-check-outline'}
              size={11} color={multipleTimeEntries ? '#0284C7' : '#059669'} style={{ marginRight: 3 }}
            />
            <Text style={[styles.modeBadgeText, { color: multipleTimeEntries ? '#0284C7' : '#059669' }]}>
              {multipleTimeEntries ? 'Multi' : 'Standard'}
            </Text>
          </View>
        </View>

        {/* Camera with face detection overlay */}
        <View style={styles.cameraCard}>
          <View style={styles.cameraWrapper}>
            <CameraView style={styles.expoCameraView} facing="front" ref={cameraRef} />

            {/* Bounding box overlay */}
            {scanPhase !== 'idle' && (
              <Animated.View
                pointerEvents="none"
                style={[styles.boundingBoxContainer, { opacity: boxOpacity, transform: [{ scale: boxScale }] }]}
              >
                <Animated.View style={[styles.corner, styles.cornerTL, { opacity: cornerOpacity, borderColor: boxColor }]} />
                <Animated.View style={[styles.corner, styles.cornerTR, { opacity: cornerOpacity, borderColor: boxColor }]} />
                <Animated.View style={[styles.corner, styles.cornerBL, { opacity: cornerOpacity, borderColor: boxColor }]} />
                <Animated.View style={[styles.corner, styles.cornerBR, { opacity: cornerOpacity, borderColor: boxColor }]} />
                <View style={[styles.centerDot, { backgroundColor: boxColor }]} />
                <View style={[styles.crossH, { backgroundColor: boxColor + '55' }]} />
                <View style={[styles.crossV, { backgroundColor: boxColor + '55' }]} />
              </Animated.View>
            )}

            {/* Progress bar during matching */}
            {scanPhase === 'matching' && (
              <View style={styles.progressBarWrap} pointerEvents="none">
                <Animated.View style={[styles.progressBarFill, {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: '#F59E0B',
                }]} />
              </View>
            )}

            {/* Phase label overlay bar */}
            <View
              style={[styles.cameraOverlayFrame, { backgroundColor: scanPhase !== 'idle' ? boxColor + 'DD' : 'rgba(0,0,0,0.65)' }]}
              pointerEvents="none"
            >
              {(scanPhase === 'idle' || scanPhase === 'detecting') ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <MaterialCommunityIcons
                  name={scanPhase === 'verified' ? 'check-circle' : scanPhase === 'failed' ? 'close-circle' : 'progress-clock'}
                  size={14} color="#FFFFFF" style={{ marginRight: 6 }}
                />
              )}
              <Text style={styles.scannerActiveText}>{phaseLabel}</Text>
            </View>
          </View>
        </View>

        {/* Result card */}
        {lastScanned ? (
          <View style={styles.resultCard}>
            <View style={styles.resultAvatarCircle}>
              <FontAwesome name="user" size={22} color="#FF6900" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={styles.resultName}>{lastScanned.name}</Text>
                <View style={[styles.resultTypePill, {
                  backgroundColor: lastScanned.type === 'Time In' ? '#ECFDF5' : '#FFF7ED',
                  borderColor: lastScanned.type === 'Time In' ? '#A7F3D0' : '#FED7AA',
                }]}>
                  <MaterialCommunityIcons
                    name={lastScanned.type === 'Time In' ? 'login' : 'logout'}
                    size={11} color={lastScanned.type === 'Time In' ? '#059669' : '#C2410C'} style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.resultTypeText, { color: lastScanned.type === 'Time In' ? '#059669' : '#C2410C' }]}>
                    {lastScanned.type}
                  </Text>
                </View>
              </View>
              <Text style={styles.resultTime}>{lastScanned.time}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <MaterialCommunityIcons name="check-circle" size={12} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={styles.resultVerified}>Face recognition successful</Text>
                {multipleTimeEntries && (
                  <View style={styles.punchCountPill}>
                    <Text style={styles.punchCountPillText}>#{lastScanned.punchCount || 1}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.idleResultCard}>
            <MaterialCommunityIcons name="face-recognition" size={24} color="#CBD5E1" style={{ marginRight: 12 }} />
            <Text style={styles.idleResultText}>Position face within frame to mark attendance</Text>
          </View>
        )}

        {/* Test scan button */}
        <TouchableOpacity
          style={[styles.simulateScanBtn, scanPhase !== 'idle' && { borderColor: '#E2E8F0' }]}
          activeOpacity={0.8} onPress={triggerFaceScan} disabled={scanPhase !== 'idle'}
        >
          <MaterialCommunityIcons
            name="face-recognition" size={15}
            color={scanPhase !== 'idle' ? '#CBD5E1' : '#FF6900'} style={{ marginRight: 6 }}
          />
          <Text style={[styles.simulateScanBtnText, scanPhase !== 'idle' && { color: '#CBD5E1' }]}>
            {scanPhase !== 'idle' ? 'Scanning...' : 'Test Scan (' + (multipleTimeEntries ? 'Multi-Punch' : 'Punch') + ')'}
          </Text>
        </TouchableOpacity>
      </View>

      <AuthPasswordModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => { setAuthModalVisible(false); router.push('/screens/enrolment'); }}
        verifyPassword={verifyPassword}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0A192F', letterSpacing: 0.3 },
  headerUnderline: { width: 32, height: 3, backgroundColor: '#FF6900', marginTop: 4, borderRadius: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  liveDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  liveDotText: { fontSize: 10, fontWeight: '800', color: '#059669', letterSpacing: 1 },
  adminButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0A192F', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  adminButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Top info row (date, clock, mode)
  topInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  dateBadgePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  dateBadgeText: { fontSize: 12, fontWeight: '600', color: '#C2410C' },
  clockPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  clockText: { fontSize: 13, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  modeBadgeText: { fontSize: 11, fontWeight: '700' },

  // Camera
  cameraCard: {
    borderRadius: 16, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#FF6900', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
  },
  cameraWrapper: {
    width: '100%', height: 280, borderRadius: 16, overflow: 'hidden',
    borderWidth: 2, borderColor: '#FF6900', backgroundColor: '#000000', position: 'relative',
  },
  expoCameraView: { flex: 1, width: '100%', height: '100%' },

  // Face detection bounding box
  boundingBoxContainer: {
    position: 'absolute', top: '15%', left: '25%', width: '50%', height: '60%',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 22, height: 22, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  centerDot: { width: 8, height: 8, borderRadius: 4 },
  crossH: { position: 'absolute', width: '70%', height: 1 },
  crossV: { position: 'absolute', width: 1, height: '70%' },

  // Progress bar
  progressBarWrap: {
    position: 'absolute', bottom: 38, left: 16, right: 16,
    height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 2 },

  // Camera overlay bar
  cameraOverlayFrame: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  scannerActiveText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  // Result card
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#A7F3D0',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  resultAvatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#FFEDD5',
    alignItems: 'center', justifyContent: 'center',
  },
  resultName: { fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1, marginRight: 8 },
  resultTypePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  resultTypeText: { fontSize: 11, fontWeight: '700' },
  resultTime: { fontSize: 20, fontWeight: '800', color: '#0A192F', marginTop: 2, letterSpacing: 0.5 },
  resultVerified: { fontSize: 11, color: '#10B981', fontWeight: '600', flex: 1 },
  punchCountPill: { backgroundColor: '#0284C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 6 },
  punchCountPillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  idleResultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  idleResultText: { fontSize: 13, color: '#94A3B8', flex: 1, lineHeight: 19 },

  // Simulate button
  simulateScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    paddingVertical: 11,
    borderRadius: 12,
  },
  simulateScanBtnText: { fontSize: 12, fontWeight: '700', color: '#FF6900' },
});