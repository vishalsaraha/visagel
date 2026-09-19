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
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useAttendance, getShiftPunchWindow, ShiftEntry } from '@/context/AttendanceContext';
import AuthPasswordModal from '@/components/AuthPasswordModal';
import * as Speech from 'expo-speech';
import { usePhoneClockSync, formatLocalDate } from '@/utils/clockSync';
import { findBestMatch } from '@/utils/faceMatch';
import { ThemedAlert } from '@/components/ThemedAlertProvider';
import { getOrgPlatformAccountDb, deriveCompanyName } from '@/utils/database';

type ScanPhase = 'idle' | 'detecting' | 'aligning' | 'matching' | 'verified' | 'failed';

/** Minimum confidence % to accept a face match */
const MIN_CONFIDENCE = 68;
/** Auto scan interval in milliseconds */
const AUTO_SCAN_INTERVAL = 3000;

export default function AttendanceScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { verifyPassword, isAuthenticated } = useAuth();
  const {
    recordPunch,
    multipleTimeEntries,
    attendanceRecords,
    enrolledEmployees,
    getActiveShift,
    aiSettings,
    voiceFeedback,
    groupScanMode,
    saveGroupScanMode,
  } = useAttendance();

  const { clockInfo } = usePhoneClockSync();

  const [orgAccount] = useState(() => getOrgPlatformAccountDb());
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('Waiting for face...');
  const [faceConfidence, setFaceConfidence] = useState(0);

  // Auto-attendance toggle
  const [autoAttendance, setAutoAttendance] = useState(true);

  const cameraReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCapturingPhotoRef = useRef(false);

  // Stop scanning and clear timer when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      setIsCameraReady(false);
      isScanningRef.current = false;
      isCapturingPhotoRef.current = false;
      if (cameraReadyTimeoutRef.current) {
        clearTimeout(cameraReadyTimeoutRef.current);
        cameraReadyTimeoutRef.current = null;
      }
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    }
  }, [isFocused]);

  // Tracks last recorded punch type per employee ID (in-memory, no restart persistence needed)
  // Used to avoid duplicate scan of the same employee in a single auto-scan cycle
  const lastPunchTimeRef = useRef<Record<string, number>>({});

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
    status?: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';
    isLate?: boolean;
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

  const handleCameraReady = useCallback(() => {
    if (cameraReadyTimeoutRef.current) {
      clearTimeout(cameraReadyTimeoutRef.current);
    }
    // Give native Android CameraX 600ms to complete pipeline binding
    cameraReadyTimeoutRef.current = setTimeout(() => {
      setIsCameraReady(true);
    }, 600);
  }, []);

  // ── Core Scan Logic ────────────────────────────────────────────────────────
  const runScan = useCallback(
    async (isAuto = false) => {
      if (!isFocused || !isCameraReady || isScanningRef.current) return;

      const pool = enrolledEmployees.filter((e) => Boolean(e.photoUri));
      if (pool.length === 0) {
        if (!isAuto) {
          ThemedAlert.alert(
            'No Enrolled Photos',
            'Please enroll employee face photos first by logging into HR Admin.',
            [
              { text: 'HR Login', onPress: handleAdminPress, style: 'default' },
              { text: 'Cancel', style: 'cancel' },
            ],
            'warning'
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
      if (cameraRef.current && isCameraReady && !isCapturingPhotoRef.current) {
        isCapturingPhotoRef.current = true;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.6,
            skipProcessing: false,
            shutterSound: false,
          });
          liveShotUri = photo?.uri ?? null;
        } catch (err) {
          // CameraX transient hardware buffer lock retry
          try {
            await delay(350);
            if (cameraRef.current && isCameraReady) {
              const retryPhoto = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                shutterSound: false,
              });
              liveShotUri = retryPhoto?.uri ?? null;
            }
          } catch (retryErr) {
            if (!isAuto) {
              console.warn('[AttendanceScreen] Snapshot retry error:', retryErr);
            }
          }
        } finally {
          isCapturingPhotoRef.current = false;
        }
      }

      if (!liveShotUri) {
        if (!isAuto) {
          setScanPhase('failed');
          setStatusMessage('Camera busy — Retrying...');
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
          if (isFocused && isCameraReady) {
            scheduleNextAutoScan();
          }
        }
        return;
      }

      if (!isAuto) {
        setScanPhase('aligning');
        setStatusMessage('Analyzing biometric liveness...');
        await delay(200);

        setScanPhase('matching');
        setStatusMessage('Matching 128-d Biometric Vectors...');
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
        modelEngine: 'local',
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
          if (isFocused && isCameraReady) {
            scheduleNextAutoScan();
          }
        }
        return;
      }

      // Successful Match!
      const matchedEmp = pool[index];
      const empId = matchedEmp.employeeId;

      // Debounce: prevent the same auto-scan triggering twice within 5 seconds
      const nowTs = Date.now();
      const lastScanTs = lastPunchTimeRef.current[empId] || 0;
      if (isAuto && nowTs - lastScanTs < 5000) {
        isScanningRef.current = false;
        if (isFocused && isCameraReady) scheduleNextAutoScan();
        return;
      }
      lastPunchTimeRef.current[empId] = nowTs;

      setScanPhase('verified');
      setStatusMessage(`Verified: ${matchedEmp.name} (${confidence}% match)`);

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      const res = recordPunch(matchedEmp.employeeId, matchedEmp.name, matchedEmp.department);
      const existing = attendanceRecords.find((r) => r.employeeId === matchedEmp.employeeId);
      const count = (existing?.punches.length || 0) + (res.isNewPunch ? 1 : 0);

      // Voice Feedback (TTS)
      if (voiceFeedback) {
        try {
          Speech.stop();
          const firstName = matchedEmp.name.split(' ')[0] || matchedEmp.name;
          let spokenText = '';
          if (!res.isNewPunch) {
            spokenText = `Already clocked ${res.type === 'IN' ? 'in' : 'out'}, ${firstName}.`;
          } else if (res.type === 'IN') {
            spokenText = res.isLate
              ? `Welcome ${firstName}. You are marked late.`
              : `Welcome ${firstName}. Clock in recorded.`;
          } else {
            spokenText = `Goodbye ${firstName}. Clock out recorded.`;
          }
          Speech.speak(spokenText, { rate: 0.95, pitch: 1.0, language: 'en-US' });
        } catch (_) {}
      }

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
        status: res.status,
        isLate: res.isLate,
      });

      // Reset after showing verification card (1000ms for Group Scan, 3500ms for Normal)
      const holdDuration = groupScanMode ? 1000 : 3500;
      setTimeout(() => {
        setScanPhase('idle');
        setFaceConfidence(0);
        setLastScanned(null);
        setStatusMessage(autoAttendance ? 'Waiting for face...' : 'Face scanner ready');
        isScanningRef.current = false;
        if (autoAttendance && isFocused && isCameraReady) {
          scheduleNextAutoScan();
        }
      }, holdDuration);
    },
    [enrolledEmployees, attendanceRecords, autoAttendance, aiSettings, isFocused, isCameraReady, voiceFeedback, groupScanMode]
  );

  const runScanRef = useRef(runScan);
  useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

  const scheduleNextAutoScan = useCallback(() => {
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    if (!autoAttendance || !isFocused || !isCameraReady) return;

    autoScanTimerRef.current = setTimeout(() => {
      if (!isScanningRef.current && runScanRef.current && isFocused && isCameraReady) {
        runScanRef.current(true);
      }
    }, AUTO_SCAN_INTERVAL);
  }, [autoAttendance, isFocused, isCameraReady]);

  // Auto scan trigger on mount, focus, camera ready, or toggle
  useEffect(() => {
    if (isFocused && isCameraReady && autoAttendance && enrolledEmployees.filter((e) => e.photoUri).length > 0) {
      scheduleNextAutoScan();
    } else {
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    }
    return () => {
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [isFocused, isCameraReady, autoAttendance, enrolledEmployees, scheduleNextAutoScan]);

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
  const todayDate = formatLocalDate(new Date());
  const todayPunches = attendanceRecords.filter((r) => r.date === todayDate);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {orgAccount.isLoggedIn && Boolean(orgAccount.orgId) && (
              <View style={styles.companyBadgeRow}>
                <FontAwesome name="building" size={10} color="#FF6900" style={{ marginRight: 4 }} />
                <Text style={styles.companyNameText} numberOfLines={1}>
                  {orgAccount.companyName || deriveCompanyName(orgAccount.orgEmail, orgAccount.orgId)}
                </Text>
              </View>
            )}
            <Text style={styles.headerTitle}>Visagel Attendance</Text>
            <View style={styles.headerUnderline} />
          </View>
          <TouchableOpacity style={styles.adminButton} activeOpacity={0.8} onPress={handleAdminPress}>
            <FontAwesome name="shield" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.adminButtonText}>HR Login</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Date + Clock Row ── */}
        <View style={styles.topInfoRow}>
          <View style={styles.dateBadgePill}>
            <MaterialCommunityIcons name="calendar-month-outline" size={12} color="#FF6900" style={{ marginRight: 4 }} />
            <Text style={styles.dateBadgeText}>{currentDateStr || 'Today'}</Text>
          </View>
          <View style={styles.clockPill}>
            <MaterialCommunityIcons name="clock-outline" size={13} color="#FF6900" style={{ marginRight: 5 }} />
            <Text style={styles.clockText}>{currentTime || '--:--:-- AM'}</Text>
          </View>
        </View>

        {/* ── Status Banner Card ── */}
        <View style={styles.statusBannerCard}>
          {/* Row 1: Shift + clock sync + punch type */}
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={[styles.statusIconDot, { backgroundColor: activeShift ? '#EDE9FE' : '#F1F5F9' }]}>
                <MaterialCommunityIcons
                  name="clock-time-eight-outline"
                  size={13}
                  color={activeShift ? '#7C3AED' : '#94A3B8'}
                />
              </View>
              <Text style={[styles.shiftLabel, !activeShift && { color: '#94A3B8' }]} numberOfLines={1}>
                {shiftLabel}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <View style={styles.clockSyncPill}>
                <MaterialCommunityIcons name="sync" size={10} color="#059669" style={{ marginRight: 3 }} />
                <Text style={styles.clockSyncText} numberOfLines={1}>{clockInfo.offsetStr}</Text>
              </View>
              {activeShift && (
                <View style={styles.shiftPunchTypePill}>
                  <Text style={styles.shiftPunchTypeText}>{resolvePunchTypeLabel(activeShift)}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.bannerDivider} />

          {/* Row 2: Multi-punch badge · Group scan · Auto toggle */}
          <View style={styles.featuresRow}>
            <View style={styles.featureBadge}>
              <MaterialCommunityIcons
                name={multipleTimeEntries ? 'repeat' : 'numeric-1-circle'}
                size={13}
                color={multipleTimeEntries ? '#2563EB' : '#64748B'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.featureText, { color: multipleTimeEntries ? '#1E40AF' : '#475569' }]}>
                {multipleTimeEntries ? 'Multi-Punch' : 'Single'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.groupScanTogglePill, groupScanMode && styles.groupScanTogglePillActive]}
              onPress={() => saveGroupScanMode(!groupScanMode)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={13}
                color={groupScanMode ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.groupScanToggleText, groupScanMode && { color: '#FFFFFF' }]}>
                Group {groupScanMode ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <View style={styles.autoToggleContainer}>
              <Animated.View
                style={[
                  styles.autoPulseDot,
                  {
                    backgroundColor: autoAttendance ? '#10B981' : '#CBD5E1',
                    transform: [{ scale: autoAttendance ? pulseAnim : 1 }],
                  },
                ]}
              />
              <Switch
                value={autoAttendance}
                onValueChange={setAutoAttendance}
                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] }}
              />
            </View>
          </View>
        </View>

        {/* ── Camera Viewfinder ── */}
        <View style={styles.cameraCard}>
          <View style={styles.cameraWrapper}>
            {!permission?.granted ? (
              <View style={styles.permissionFallback}>
                <MaterialCommunityIcons name="camera-off" size={40} color="#EF4444" style={{ marginBottom: 8 }} />
                <Text style={styles.permissionTitle}>Camera Access Required</Text>
                <Text style={styles.permissionSubtitle}>
                  Grant camera permissions to enable face recognition & attendance marking.
                </Text>
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                  <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
                </TouchableOpacity>
              </View>
            ) : !isFocused ? (
              <View style={styles.permissionFallback}>
                <ActivityIndicator size="small" color="#FF6900" style={{ marginBottom: 8 }} />
                <Text style={styles.permissionSubtitle}>Resuming camera...</Text>
              </View>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="front"
                  mode="picture"
                  animateShutter={false}
                  ref={cameraRef}
                  onCameraReady={handleCameraReady}
                  onMountError={(e) => {
                    console.warn('[AttendanceScreen] Camera mount error:', e?.message);
                    setIsCameraReady(false);
                  }}
                />

                {/* HUD Target Box */}
                <View style={styles.targetHudContainer} pointerEvents="none">
                  <View style={[styles.hudCorner, styles.hudTL, { borderColor: hudColor }]} />
                  <View style={[styles.hudCorner, styles.hudTR, { borderColor: hudColor }]} />
                  <View style={[styles.hudCorner, styles.hudBL, { borderColor: hudColor }]} />
                  <View style={[styles.hudCorner, styles.hudBR, { borderColor: hudColor }]} />

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
                                outputRange: [-100, 100],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Progress bar */}
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

                {/* Auto scan badge - top left */}
                {autoAttendance && scanPhase === 'idle' && (
                  <View style={styles.autoScanBadge} pointerEvents="none">
                    <View style={styles.radarRing} />
                    <Text style={styles.autoScanBadgeText}>Auto-Scan Active</Text>
                  </View>
                )}

                {/* Confidence badge - top right */}
                {faceConfidence > 0 && (
                  <View style={styles.confidenceBadge} pointerEvents="none">
                    <Text style={styles.confidenceBadgeText}>{faceConfidence}%</Text>
                  </View>
                )}

                {/* Status overlay - bottom strip */}
                <View
                  style={[
                    styles.cameraOverlayFrame,
                    {
                      backgroundColor:
                        scanPhase === 'failed'
                          ? 'rgba(239,68,68,0.93)'
                          : scanPhase === 'verified'
                          ? 'rgba(16,185,129,0.93)'
                          : scanPhase !== 'idle'
                          ? `${hudColor}E6`
                          : 'rgba(10,25,47,0.80)',
                    },
                  ]}
                  pointerEvents="none"
                >
                  {['detecting', 'aligning', 'matching'].includes(scanPhase) ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
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
                      size={15}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
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

        {/* ── Scan Button ── */}
        <TouchableOpacity
          style={[styles.primaryScanBtn, scanPhase !== 'idle' && styles.primaryScanBtnDisabled]}
          activeOpacity={0.85}
          onPress={() => runScan(false)}
          disabled={scanPhase !== 'idle'}
        >
          {scanPhase !== 'idle' ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.primaryScanBtnText}>Processing Face...</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="face-recognition" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.primaryScanBtnText}>
                {autoAttendance ? 'Scan Face Instantly' : 'Scan & Mark Attendance'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Auto mode label ── */}
        <View style={styles.autoModeLabel}>
          <Animated.View
            style={[
              styles.autoPulseDotLarge,
              {
                backgroundColor: autoAttendance ? '#10B981' : '#CBD5E1',
                transform: [{ scale: autoAttendance ? pulseAnim : 1 }],
              },
            ]}
          />
          <Text style={styles.autoModeLabelText}>
            {autoAttendance ? 'Auto Attendance ON — Scanning every 3s' : 'Manual Mode — Tap button to scan'}
          </Text>
        </View>

        {/* ── No face enrolled warning ── */}
        {faceMappedCount === 0 && (
          <TouchableOpacity onPress={handleAdminPress} style={styles.noFaceHint}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C2410C" style={{ marginRight: 8 }} />
            <Text style={styles.noFaceHintText}>
              No employee faces enrolled yet. Tap here to login as HR and enroll photos.
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Verified Punch Result Card ── */}
        {lastScanned ? (
          <View style={styles.resultCard}>
            {/* Avatar */}
            <View style={styles.resultAvatarCircle}>
              {lastScanned.photoUri ? (
                <Image source={{ uri: lastScanned.photoUri }} style={styles.resultAvatarImage} />
              ) : (
                <FontAwesome name="user" size={24} color="#FF6900" />
              )}
              {/* Verified check overlay */}
              <View style={styles.resultAvatarCheck}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
              </View>
            </View>

            {/* Info */}
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Name row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={styles.resultName} numberOfLines={1}>{lastScanned.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 8 }}>
                  {lastScanned.isLate && (
                    <View style={styles.latePill}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={10} color="#DC2626" style={{ marginRight: 2 }} />
                      <Text style={styles.latePillText}>LATE</Text>
                    </View>
                  )}
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
                    <Text style={[styles.resultTypeText, { color: lastScanned.type === 'Time In' ? '#059669' : '#C2410C' }]}>
                      {lastScanned.type}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Department + ID */}
              <Text style={styles.resultDeptText} numberOfLines={1}>
                {lastScanned.id} · {lastScanned.department}
              </Text>

              {/* Time */}
              <Text style={styles.resultTime}>{lastScanned.time}</Text>

              {/* Confidence + punch count */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
                <View style={styles.confPill}>
                  <MaterialCommunityIcons name="check-decagram" size={11} color="#059669" style={{ marginRight: 3 }} />
                  <Text style={styles.confPillText}>Match {lastScanned.confidence}%</Text>
                </View>
                {multipleTimeEntries && (
                  <View style={styles.punchCountPill}>
                    <Text style={styles.punchCountPillText}>Punch #{lastScanned.punchCount || 1}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* ── Idle Hint Card ── */
          <View style={styles.idleResultCard}>
            <View style={styles.idleIconBox}>
              <MaterialCommunityIcons
                name={autoAttendance ? 'face-recognition' : 'hand-pointing-up'}
                size={22}
                color={autoAttendance ? '#10B981' : '#FF6900'}
              />
            </View>
            <Text style={styles.idleResultText}>
              {autoAttendance
                ? 'Auto Attendance Active — Stand in front of the camera to mark attendance automatically.'
                : 'Manual Mode — Position your face inside the frame and tap the scan button.'}
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

function resolvePunchTypeLabel(shift: ShiftEntry | null) {
  if (!shift) return 'Time In';
  const win = getShiftPunchWindow(shift, new Date());
  return win === 'IN' ? 'Time In' : 'Time Out';
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
  statusIconDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  shiftLabel: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  shiftPunchTypePill: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shiftPunchTypeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  clockSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  clockSyncText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  groupScanTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  groupScanTogglePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  groupScanToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
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
  confidenceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  confidenceBadgeText: {
    fontSize: 10.5,
    color: '#FFFFFF',
    fontWeight: '800',
  },
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
  autoModeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  autoPulseDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  autoModeLabelText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
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
  resultAvatarCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  resultName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  resultDeptText: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 1 },
  latePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  latePillText: { fontSize: 10.5, fontWeight: '800', color: '#DC2626' },
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
  confPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
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
  idleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
