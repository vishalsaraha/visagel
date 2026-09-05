import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Alert,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAttendance } from '@/context/AttendanceContext';
import AuthPasswordModal from '@/components/AuthPasswordModal';
import { findBestMatch } from '@/utils/faceMatch';

type ScanPhase = 'idle' | 'detecting' | 'aligning' | 'matching' | 'verified' | 'failed';

/** Minimum confidence % to accept a face match */
const MIN_CONFIDENCE = 68;
/** Auto scan interval in milliseconds */
const AUTO_SCAN_INTERVAL = 3000;

export default function AttendanceScreen() {
  const router = useRouter();
  const { verifyPassword, isAuthenticated } = useAuth();
  const {
    recordPunch,
    multipleTimeEntries,
    attendanceRecords,
    enrolledEmployees,
    getActiveShift,
    aiSettings,
  } = useAttendance();

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('Waiting for face...');
  const [faceConfidence, setFaceConfidence] = useState(0);

  // Auto-attendance toggle
  const [autoAttendance, setAutoAttendance] = useState(true);

  // Cooldown tracker per employee ID (timestamp of last punch)
  const lastPunchMapRef = useRef<Record<string, number>>({});

  const [lastScanned, setLastScanned] = useState<{
    id: string;
    name: string;
    department: string;
    time: string;
    type: string;
    punchCount?: number;
    summary: string;
    photoUri?: string | null;
    confidence?: number;
  } | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const isScanningRef = useRef(false);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const laserAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const laserLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // ── Date ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    );
  }, []);

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes(),
        s = now.getSeconds();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setCurrentTime(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Pulsing Radar Animation ────────────────────────────────────────────────
  useEffect(() => {
    if (autoAttendance) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [autoAttendance]);

  // ── Laser animation during scan ────────────────────────────────────────────
  useEffect(() => {
    if (['detecting', 'aligning', 'matching'].includes(scanPhase)) {
      laserLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      laserLoopRef.current.start();
    } else {
      laserLoopRef.current?.stop();
      laserAnim.setValue(0);
    }
    return () => laserLoopRef.current?.stop();
  }, [scanPhase]);

  // ── Core Scan Logic ────────────────────────────────────────────────────────
  const runScan = useCallback(
    async (isAuto = false) => {
      if (isScanningRef.current) return;

      const pool = enrolledEmployees.filter((e) => Boolean(e.photoUri));
      if (pool.length === 0) {
        if (!isAuto) {
          Alert.alert(
            'No Enrolled Photos',
            'Please enroll employee face photos first by logging into HR Admin.',
            [
              { text: 'HR Login', onPress: handleAdminPress },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }
        return;
      }

      isScanningRef.current = true;
      progressAnim.setValue(0);
      setFaceConfidence(0);

      if (!isAuto) {
        setScanPhase('detecting');
        setStatusMessage('Capturing face image...');
      }

      let liveShotUri: string | null = null;
      try {
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
          });
          liveShotUri = photo?.uri ?? null;
        }
      } catch (err) {
        console.warn('[AttendanceScreen] Snapshot error:', err);
      }

      if (!liveShotUri) {
        if (!isAuto) {
          setScanPhase('failed');
          setStatusMessage('Camera error — Retrying...');
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch (_) {}
          setTimeout(() => {
            setScanPhase('idle');
            setStatusMessage(autoAttendance ? 'Auto-scanning for faces...' : 'Face scanner ready');
            isScanningRef.current = false;
          }, 1800);
        } else {
          isScanningRef.current = false;
          scheduleNextAutoScan();
        }
        return;
      }

      if (!isAuto) {
        setScanPhase('aligning');
        setStatusMessage('Analyzing biometric liveness...');
        await delay(200);

        setScanPhase('matching');
        setStatusMessage(
          aiSettings.modelEngine === 'cloud'
            ? 'Querying Cloud Face AI Engine...'
            : 'Matching 128-d Biometric Vectors...'
        );
        Animated.timing(progressAnim, {
          toValue: 0.7,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      }

      // Match face against enrolled pool using Industry-Standard Face Engine
      const photoUris = pool.map((e) => e.photoUri as string);
      const matchResult = await findBestMatch(liveShotUri, photoUris, {
        minConfidence: aiSettings.minConfidence,
        livenessMode: aiSettings.livenessMode,
        modelEngine: aiSettings.modelEngine,
        cloudConfig: {
          url: aiSettings.cloudApiUrl,
          apiKey: aiSettings.cloudApiKey,
          apiSecret: aiSettings.cloudApiSecret,
        },
      });

      const { index, confidence, isCovered, livenessPassed, livenessReason } = matchResult;

      if (!isAuto) {
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      }
      setFaceConfidence(confidence);

      // Check if match threshold or liveness verification failed
      if (index === -1 || confidence < aiSettings.minConfidence || isCovered || !livenessPassed) {
        if (!isAuto) {
          setScanPhase('failed');
          let failMsg = `No face match (${confidence}%) — Try again`;
          if (isCovered) failMsg = 'Camera covered or too dark';
          else if (!livenessPassed) failMsg = livenessReason || 'Liveness check failed (Spoof risk)';

          setStatusMessage(failMsg);
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch (_) {}

          setTimeout(() => {
            setScanPhase('idle');
            setFaceConfidence(0);
            setStatusMessage(autoAttendance ? 'Waiting for face...' : 'Face scanner ready');
            isScanningRef.current = false;
          }, 2000);
        } else {
          // In auto mode, quietly update status and schedule next scan
          if (isCovered) {
            setStatusMessage('Waiting for face...');
          } else if (!livenessPassed) {
            setStatusMessage('Position face in frame...');
          } else if (index === -1) {
            setStatusMessage('Scanning face...');
          }
          isScanningRef.current = false;
          scheduleNextAutoScan();
        }
        return;
      }

      // Successful Match!
      const matchedEmp = pool[index];
      const empId = matchedEmp.employeeId;

      // Check Cooldown Window to prevent duplicate punches
      const nowTs = Date.now();
      const lastPunchTs = lastPunchMapRef.current[empId] || 0;
      const cooldownMs = (aiSettings.scanCooldownSec || 30) * 1000;

      if (nowTs - lastPunchTs < cooldownMs) {
        if (!isAuto) {
          setScanPhase('verified');
          setStatusMessage(`${matchedEmp.name} scanned recently (Cooldown active)`);
        }
        isScanningRef.current = false;
        if (isAuto) scheduleNextAutoScan();
        return;
      }

      // Update cooldown tracker
      lastPunchMapRef.current[empId] = nowTs;

      setScanPhase('verified');
      setStatusMessage(`Verified: ${matchedEmp.name} (${confidence}% match)`);

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      const res = recordPunch(matchedEmp.employeeId, matchedEmp.name, matchedEmp.department);
      const existing = attendanceRecords.find((r) => r.employeeId === matchedEmp.employeeId);
      const count = (existing?.punches.length || 0) + (res.isNewPunch ? 1 : 0);

      setLastScanned({
        id: matchedEmp.employeeId,
        name: matchedEmp.name,
        department: matchedEmp.department || 'General',
        time: res.punch.time,
        type: res.type === 'IN' ? 'Time In' : 'Time Out',
        punchCount: count,
        summary: res.summary,
        photoUri: matchedEmp.photoUri,
        confidence,
      });

      // Reset after showing verification card
      setTimeout(() => {
        setScanPhase('idle');
        setFaceConfidence(0);
        setStatusMessage(autoAttendance ? 'Waiting for face...' : 'Face scanner ready');
        isScanningRef.current = false;
        if (autoAttendance) {
          scheduleNextAutoScan();
        }
      }, 3500);
    },
    [enrolledEmployees, attendanceRecords, autoAttendance, aiSettings]
  );

  const runScanRef = useRef(runScan);
  useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

  const scheduleNextAutoScan = useCallback(() => {
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    if (!autoAttendance) return;

    autoScanTimerRef.current = setTimeout(() => {
      if (!isScanningRef.current && runScanRef.current) {
        runScanRef.current(true);
      }
    }, AUTO_SCAN_INTERVAL);
  }, [autoAttendance]);

  // Auto scan trigger on mount or toggle
  useEffect(() => {
    if (autoAttendance && enrolledEmployees.filter((e) => e.photoUri).length > 0) {
      scheduleNextAutoScan();
    } else {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    }
    return () => {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    };
  }, [autoAttendance, enrolledEmployees, scheduleNextAutoScan]);

  const handleAdminPress = () => {
    if (isAuthenticated) router.push('/screens/enrolment');
    else setAuthModalVisible(true);
  };

  // ── Active Shift Info ──────────────────────────────────────────────────────
  const activeShift = getActiveShift();
  const shiftLabel = activeShift
    ? `${activeShift.name} · ${pad(activeShift.startHour)}:${pad(activeShift.startMin)} – ${pad(activeShift.endHour)}:${pad(activeShift.endMin)}`
    : 'No active shift';

  // ── HUD Colour ─────────────────────────────────────────────────────────────
  const hudColor =
    scanPhase === 'verified'
      ? '#10B981'
      : scanPhase === 'failed'
      ? '#EF4444'
      : scanPhase === 'matching'
      ? '#F59E0B'
      : ['aligning', 'detecting'].includes(scanPhase)
      ? '#FF6900'
      : autoAttendance
      ? '#10B981'
      : '#0284C7';

  const faceMappedCount = enrolledEmployees.filter((e) => e.photoUri).length;
  const todayDate = new Date().toISOString().split('T')[0];
  const todayPunches = attendanceRecords.filter((r) => r.date === todayDate);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <View style={styles.companyBadgeRow}>
              <FontAwesome name="building" size={11} color="#FF6900" style={{ marginRight: 4 }} />
              <Text style={styles.companyNameText}>Branzept</Text>
            </View>
            <Text style={styles.headerTitle}>Visagel Attendance</Text>
            <View style={styles.headerUnderline} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.adminButton} activeOpacity={0.8} onPress={handleAdminPress}>
              <FontAwesome name="shield" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.adminButtonText}>HR Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Info Bar ── */}
        <View style={styles.topInfoRow}>
          <View style={styles.dateBadgePill}>
            <MaterialCommunityIcons name="calendar-month-outline" size={12} color="#FF6900" style={{ marginRight: 4 }} />
            <Text style={styles.dateBadgeText}>{currentDateStr || 'Today'}</Text>
          </View>
          <View style={styles.clockPill}>
            <MaterialCommunityIcons name="clock-outline" size={12} color="#0F172A" style={{ marginRight: 4 }} />
            <Text style={styles.clockText}>{currentTime || '--:--:-- AM'}</Text>
          </View>
        </View>

        {/* ── Shift & Multi-Punch Status Banner ── */}
        <View style={styles.statusBannerCard}>
          {/* Shift Row */}
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <MaterialCommunityIcons
                name="clock-time-eight-outline"
                size={14}
                color={activeShift ? '#7C3AED' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.shiftLabel, !activeShift && { color: '#94A3B8' }]}>{shiftLabel}</Text>
            </View>
            {activeShift && (
              <View style={styles.shiftPunchTypePill}>
                <Text style={styles.shiftPunchTypeText}>
                  Next: {resolvePunchTypeLabel(activeShift)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bannerDivider} />

          {/* Multi-Punch & Auto Mode Indicators */}
          <View style={styles.featuresRow}>
            <View style={styles.featureBadge}>
              <MaterialCommunityIcons
                name={multipleTimeEntries ? 'repeat' : 'numeric-1-circle'}
                size={14}
                color={multipleTimeEntries ? '#2563EB' : '#64748B'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.featureText, { color: multipleTimeEntries ? '#1E40AF' : '#475569' }]}>
                {multipleTimeEntries ? 'Multi-Punch: ON' : 'Single Punch: ON'}
              </Text>
            </View>

            <View style={styles.autoToggleContainer}>
              <Animated.View
                style={[
                  styles.autoPulseDot,
                  {
                    backgroundColor: autoAttendance ? '#10B981' : '#94A3B8',
                    transform: [{ scale: autoAttendance ? pulseAnim : 1 }],
                  },
                ]}
              />
              <Text style={styles.autoToggleLabel}>
                {autoAttendance ? 'Auto Attendance ON' : 'Manual Scan Mode'}
              </Text>
              <Switch
                value={autoAttendance}
                onValueChange={setAutoAttendance}
                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>
        </View>

        {/* ── Camera Viewfinder Card ── */}
        <View style={styles.cameraCard}>
          <View style={styles.cameraWrapper}>
            {!permission?.granted ? (
              <View style={styles.permissionFallback}>
                <MaterialCommunityIcons name="camera-off" size={40} color="#EF4444" style={{ marginBottom: 8 }} />
                <Text style={styles.permissionTitle}>Camera Access Required</Text>
                <Text style={styles.permissionSubtitle}>
                  Please grant camera permissions to enable face recognition & attendance marking.
                </Text>
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                  <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="front"
                  ref={cameraRef}
                />

                {/* HUD Corners & Target Box */}
                <View style={styles.targetHudContainer} pointerEvents="none">
                  <View style={[styles.hudCorner, styles.hudTL, { borderColor: hudColor }]} />
                  <View style={[styles.hudCorner, styles.hudTR, { borderColor: hudColor }]} />
                  <View style={[styles.hudCorner, styles.hudBL, { borderColor: hudColor }]} />
                  <View style={[styles.hudCorner, styles.hudBR, { borderColor: hudColor }]} />

                  {/* Biometric Laser Scanning Line */}
                  {(['detecting', 'aligning', 'matching'].includes(scanPhase) || (autoAttendance && scanPhase === 'idle')) && (
                    <Animated.View
                      style={[
                        styles.laserLine,
                        {
                          backgroundColor: hudColor,
                          transform: [
                            {
                              translateY: laserAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-90, 90],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Progress bar during active matching */}
                {scanPhase === 'matching' && (
                  <View style={styles.progressBarWrap} pointerEvents="none">
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                          backgroundColor: '#F59E0B',
                        },
                      ]}
                    />
                  </View>
                )}

                {/* Auto scan radar indicator badge */}
                {autoAttendance && scanPhase === 'idle' && (
                  <View style={styles.autoScanBadge} pointerEvents="none">
                    <View style={styles.radarRing} />
                    <Text style={styles.autoScanBadgeText}>Auto-Scan Active</Text>
                  </View>
                )}

                {/* Camera Status Strip */}
                <View
                  style={[
                    styles.cameraOverlayFrame,
                    {
                      backgroundColor:
                        scanPhase === 'failed'
                          ? 'rgba(239,68,68,0.92)'
                          : scanPhase === 'verified'
                          ? 'rgba(16,185,129,0.94)'
                          : scanPhase !== 'idle'
                          ? `${hudColor}E6`
                          : 'rgba(10,25,47,0.75)',
                    },
                  ]}
                  pointerEvents="none"
                >
                  {['detecting', 'aligning', 'matching'].includes(scanPhase) ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : (
                    <MaterialCommunityIcons
                      name={
                        scanPhase === 'verified'
                          ? 'check-decagram'
                          : scanPhase === 'failed'
                          ? 'alert-circle-outline'
                          : autoAttendance
                          ? 'face-recognition'
                          : 'camera-iris'
                      }
                      size={14}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text style={styles.scannerActiveText} numberOfLines={1}>
                    {statusMessage}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Manual Scan Button (Fast Trigger) ── */}
        <TouchableOpacity
          style={[styles.primaryScanBtn, scanPhase !== 'idle' && styles.primaryScanBtnDisabled]}
          activeOpacity={0.85}
          onPress={() => runScan(false)}
          disabled={scanPhase !== 'idle'}
        >
          {scanPhase !== 'idle' ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryScanBtnText}>Processing Face...</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="face-recognition" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryScanBtnText}>
                {autoAttendance ? 'Scan Face Instantly' : 'Scan & Mark Attendance'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Warning if no photos mapped ── */}
        {faceMappedCount === 0 && (
          <TouchableOpacity onPress={handleAdminPress} style={styles.noFaceHint}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C2410C" style={{ marginRight: 8 }} />
            <Text style={styles.noFaceHintText}>
              No employee faces enrolled yet. Tap here to login as HR and enroll employee photos.
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Verified Punch Card ── */}
        {lastScanned ? (
          <View style={styles.resultCard}>
            <View style={styles.resultAvatarCircle}>
              {lastScanned.photoUri ? (
                <Image source={{ uri: lastScanned.photoUri }} style={styles.resultAvatarImage} />
              ) : (
                <FontAwesome name="user" size={20} color="#FF6900" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {lastScanned.name}
                  </Text>
                  <Text style={styles.resultDeptText} numberOfLines={1}>
                    {lastScanned.id} · {lastScanned.department}
                  </Text>
                </View>
                <View
                  style={[
                    styles.resultTypePill,
                    {
                      backgroundColor: lastScanned.type === 'Time In' ? '#ECFDF5' : '#FFF7ED',
                      borderColor: lastScanned.type === 'Time In' ? '#A7F3D0' : '#FED7AA',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={lastScanned.type === 'Time In' ? 'login' : 'logout'}
                    size={11}
                    color={lastScanned.type === 'Time In' ? '#059669' : '#C2410C'}
                    style={{ marginRight: 3 }}
                  />
                  <Text
                    style={[
                      styles.resultTypeText,
                      { color: lastScanned.type === 'Time In' ? '#059669' : '#C2410C' },
                    ]}
                  >
                    {lastScanned.type}
                  </Text>
                </View>
              </View>
              <Text style={styles.resultTime}>{lastScanned.time}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, flexWrap: 'wrap' }}>
                <MaterialCommunityIcons name="check-decagram" size={12} color="#10B981" style={{ marginRight: 2 }} />
                <Text style={styles.resultVerified}>Match {lastScanned.confidence}%</Text>
                {multipleTimeEntries && (
                  <View style={styles.punchCountPill}>
                    <Text style={styles.punchCountPillText}>Punch #{lastScanned.punchCount || 1}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.idleResultCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#64748B" style={{ marginRight: 10 }} />
            <Text style={styles.idleResultText}>
              {autoAttendance
                ? 'Auto Attendance Active: Stand in front of camera to mark attendance automatically.'
                : 'Manual Mode: Position your face inside the frame and tap the scan button.'}
            </Text>
          </View>
        )}


      </ScrollView>

      <AuthPasswordModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => {
          setAuthModalVisible(false);
          router.push('/screens/enrolment');
        }}
        verifyPassword={verifyPassword}
      />
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const pad = (n: number) => String(n).padStart(2, '0');

function resolvePunchTypeLabel(shift: { startHour: number; startMin: number; endHour: number; endMin: number }) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = shift.startHour * 60 + shift.startMin;
  let endMins = shift.endHour * 60 + shift.endMin;
  if (endMins <= startMins) endMins += 24 * 60;
  let relNow = nowMins < startMins ? nowMins + 24 * 60 : nowMins;
  const half = (endMins - startMins) / 2;
  return relNow - startMins < half ? 'Time In' : 'Time Out';
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  companyBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  companyNameText: { fontSize: 11, fontWeight: '800', color: '#FF6900', letterSpacing: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0A192F', letterSpacing: 0.3 },
  headerUnderline: { width: 32, height: 3, backgroundColor: '#FF6900', marginTop: 4, borderRadius: 2 },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A192F',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  adminButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  scrollContent: { padding: 14, paddingBottom: 30 },
  topInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  dateBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  dateBadgeText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  clockPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  clockText: { fontSize: 12, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  statusBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  shiftLabel: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  shiftPunchTypePill: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shiftPunchTypeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  bannerDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  featureText: { fontSize: 11, fontWeight: '700' },
  autoToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autoPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  autoToggleLabel: { fontSize: 11, fontWeight: '700', color: '#334155' },
  cameraCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  cameraWrapper: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#FF6900',
    backgroundColor: '#000000',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionFallback: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    width: '100%',
    height: '100%',
  },
  permissionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  permissionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: '#FF6900',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  grantBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  flipCameraBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  targetHudContainer: {
    position: 'absolute',
    width: 210,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudCorner: { position: 'absolute', width: 24, height: 24, borderWidth: 3.5 },
  hudTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  hudTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  hudBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  hudBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  laserLine: {
    position: 'absolute',
    width: '100%',
    height: 2.5,
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
  },
  progressBarWrap: {
    position: 'absolute',
    bottom: 38,
    left: 16,
    right: 16,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 2 },
  autoScanBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  radarRing: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  autoScanBadgeText: { fontSize: 10.5, color: '#FFFFFF', fontWeight: '800' },
  cameraOverlayFrame: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerActiveText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2, flexShrink: 1 },
  primaryScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6900',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryScanBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  primaryScanBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  noFaceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  noFaceHintText: { flex: 1, fontSize: 11.5, color: '#C2410C', fontWeight: '600' },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  resultAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resultAvatarImage: { width: '100%', height: '100%', borderRadius: 24, resizeMode: 'cover' },
  resultName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  resultDeptText: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 1 },
  resultTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultTypeText: { fontSize: 11, fontWeight: '800' },
  resultTime: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 3 },
  resultVerified: { fontSize: 11.5, color: '#10B981', fontWeight: '700' },
  punchCountPill: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  punchCountPillText: { fontSize: 10.5, fontWeight: '700', color: '#C2410C' },
  idleResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  idleResultText: { flex: 1, fontSize: 12, color: '#64748B', fontWeight: '500', lineHeight: 18 },
  logSectionHeader: { marginTop: 4, marginBottom: 8 },
  logSectionTitle: { fontSize: 11.5, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  emptyLogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyLogText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  logItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  logAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logAvatarText: { fontSize: 14, fontWeight: '800', color: '#FF6900' },
  logEmpName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  logEmpMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },
  logTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  logTypeText: { fontSize: 10.5, fontWeight: '700' },
  logTimeText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
});
