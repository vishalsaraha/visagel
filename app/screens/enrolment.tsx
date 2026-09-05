import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  FlatList,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAttendance, EnrolledEmployee } from '@/context/AttendanceContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import AppDateTimePicker from '@/components/AppDateTimePicker';
import { ThemedAlert } from '@/components/ThemedAlertProvider';
import { getOrgPlatformAccountDb, deriveCompanyName } from '@/utils/database';

const THEME_COLOR = '#FF6900';
const THEME_COLOR_10_OPACITY = 'rgba(255, 105, 0, 0.1)';


export default function EnrolmentScreen() {
  const router = useRouter();
  const { logout, verifyPassword } = useAuth();
  const {
    enrolledEmployees,
    addEnrolledEmployee,
    updateEnrolledEmployee,
    deleteEnrolledEmployee,
    departments: contextDepts,
  } = useAttendance();

  const [orgAccount] = useState(() => getOrgPlatformAccountDb());

  // Build dept list: always include 'All' at front
  const DEPT_FILTER_LIST = ['All', ...contextDepts] as const;
  type Department = (typeof DEPT_FILTER_LIST)[number];

  const [selectedDept, setSelectedDept] = useState<Department>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [faceStatusFilter, setFaceStatusFilter] = useState<'All' | 'Mapped' | 'Pending'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'recent'>('name');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const hasActiveFilters = selectedDept !== 'All' || faceStatusFilter !== 'All' || sortBy !== 'name';
  const activeFilterCount = (selectedDept !== 'All' ? 1 : 0) + (faceStatusFilter !== 'All' ? 1 : 0) + (sortBy !== 'name' ? 1 : 0);
  const handleResetFilters = () => {
    setSelectedDept('All');
    setFaceStatusFilter('All');
    setSortBy('name');
  };
  
  const [formData, setFormData] = useState({
    employeeId: 'BR-029',
    name: '',
    department: contextDepts[0] || 'Engineering',
    phone: '',
    joiningDate: new Date(),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Face detection overlay animation for Enrolment Camera
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reticleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cameraVisible) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.96, duration: 900, useNativeDriver: true }),
        ])
      );
      const reticleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(reticleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(reticleAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();
      reticleLoop.start();
      return () => {
        pulseLoop.stop();
        reticleLoop.stop();
      };
    }
  }, [cameraVisible]);

  // Vertical Collapsible Dock State & Animation
  const [isDockOpen, setIsDockOpen] = useState(false);
  const animationValue = useRef(new Animated.Value(0)).current;

  const toggleDock = () => {
    const toValue = isDockOpen ? 0 : 1;
    setIsDockOpen(!isDockOpen);
    Animated.spring(animationValue, {
      toValue,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  // Expo Camera permission hook
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!permission || !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.6,
          skipProcessing: false,
          shutterSound: false,
        });
        if (photo && photo.uri) {
          setCapturedPhoto(photo.uri);
          setCameraVisible(false);
          return;
        }
      } catch {
        try {
          await new Promise((r) => setTimeout(r, 300));
          if (cameraRef.current) {
            const retryPhoto = await cameraRef.current.takePictureAsync({
              quality: 0.5,
              shutterSound: false,
            });
            if (retryPhoto && retryPhoto.uri) {
              setCapturedPhoto(retryPhoto.uri);
              setCameraVisible(false);
              return;
            }
          }
        } catch {
          ThemedAlert.alert('Capture Error', 'Failed to capture photo. Please try again.', [{ text: 'OK' }], 'error');
        }
      }
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      employeeId: `BR-0${(26 + enrolledEmployees.length + 1).toString().padStart(2, '0')}`,
      name: '',
      department: selectedDept === 'All' ? (contextDepts[0] || 'Engineering') : selectedDept,
      phone: '',
      joiningDate: new Date(),
    });
    setCapturedPhoto(null);
    setModalVisible(true);
    toggleDock();
  };

  const handleOpenEditModal = (item: EnrolledEmployee) => {
    setEditingId(item.id);
    const parsedDate = item.joiningDate ? new Date(item.joiningDate) : new Date();
    setFormData({
      employeeId: item.employeeId,
      name: item.name,
      department: item.department || 'Engineering',
      phone: item.phone,
      joiningDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    });
    setCapturedPhoto(item.photoUri);
    setModalVisible(true);
  };

  const handleDeleteEnrolment = (id: string, name: string) => {
    ThemedAlert.alert(
      'Delete Enrolment',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEnrolledEmployee(id);
            ThemedAlert.alert('Deleted', 'Enrolment record removed successfully.', [{ text: 'OK' }], 'success');
          },
        },
      ]
    );
  };

  const handleEnrolment = async () => {
    if (!formData.employeeId.trim()) {
      ThemedAlert.alert('Validation Error', 'Please enter an Employee ID.', [{ text: 'OK' }], 'warning');
      return;
    }
    if (!formData.name || !formData.phone) {
      ThemedAlert.alert('Validation Error', 'Please fill in Employee Name and Phone Number.', [{ text: 'OK' }], 'warning');
      return;
    }

    // Uniqueness check for Employee ID (only when adding new)
    if (!editingId) {
      const duplicate = enrolledEmployees.find(
        (e) => e.employeeId.toLowerCase() === formData.employeeId.trim().toLowerCase()
      );
      if (duplicate) {
        ThemedAlert.alert('Duplicate ID', `Employee ID "${formData.employeeId.trim()}" already exists. Please choose a different ID.`, [{ text: 'OK' }], 'error');
        return;
      }
    }

    const joiningDateStr = formData.joiningDate.toISOString().split('T')[0];

    if (editingId) {
      await updateEnrolledEmployee(editingId, {
        name: formData.name,
        department: formData.department,
        phone: formData.phone,
        joiningDate: joiningDateStr,
        photoUri: capturedPhoto,
      });
      ThemedAlert.alert('Success', `Successfully updated ${formData.name}!`, [{ text: 'Done' }], 'success');
    } else {
      await addEnrolledEmployee({
        employeeId: formData.employeeId.trim(),
        name: formData.name,
        department: formData.department,
        phone: formData.phone,
        joiningDate: joiningDateStr,
        photoUri: capturedPhoto,
      });
      ThemedAlert.alert('Success', `Successfully enrolled ${formData.name} (${formData.employeeId.trim()})!`, [{ text: 'Done' }], 'success');
    }

    setModalVisible(false);
    setEditingId(null);
    setCapturedPhoto(null);
  };

  const generateCsvFile = async (): Promise<string | null> => {
    try {
      let csvHeader = 'Employee ID,Full Name,Department,Phone Number,Joining Date,Face Mapped\n';
      let csvRows = filteredList
        .map(
          (item) =>
            `"${item.employeeId}","${item.name}","${item.department || 'General'}","${item.phone}","${item.joiningDate || 'N/A'}","${item.photoUri ? 'Yes' : 'No'}"`
        )
        .join('\n');

      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDir) return null;
      
      const fileUri = `${baseDir}employee_enrolments.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvHeader + csvRows, {
        encoding: 'utf8',
      });

      return fileUri;
    } catch {
      ThemedAlert.alert('CSV Error', 'Failed to generate CSV file.', [{ text: 'OK' }], 'error');
      return null;
    }
  };

  const handleExportCsv = async () => {
    toggleDock();
    if (filteredList.length === 0) {
      ThemedAlert.alert('Notice', 'No enrolment records available to export.', [{ text: 'OK' }], 'info');
      return;
    }

    const fileUri = await generateCsvFile();
    if (fileUri) {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Enrolment Data',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        ThemedAlert.alert('Error', 'Sharing is not available on this device.', [{ text: 'OK' }], 'error');
      }
    }
  };

  const handleShareViaEmail = async () => {
    toggleDock();
    if (filteredList.length === 0) {
      ThemedAlert.alert('Notice', 'No enrolment records available to send.', [{ text: 'OK' }], 'info');
      return;
    }

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      ThemedAlert.alert('Error', 'Email composition is not available on this device.', [{ text: 'OK' }], 'error');
      return;
    }

    const fileUri = await generateCsvFile();
    if (fileUri) {
      await MailComposer.composeAsync({
        subject: 'Employee Enrolment Records Report',
        body: `Please find attached employee enrolment records (${selectedDept} department).`,
        attachments: [fileUri],
      });
    }
  };

  // Filtered employees list based on Department, Search, Face Status & Sorting
  const filteredList = enrolledEmployees
    .filter((item) => {
      const matchesDept = selectedDept === 'All' || item.department === selectedDept;
      const q = searchQuery.trim().toLowerCase();
      const cleanQ = q.replace(/[^a-z0-9]/g, '');
      const cleanId = (item.employeeId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
      const cleanPhoneQ = q.replace(/[^0-9]/g, '');

      const matchesSearch =
        !q ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.employeeId && item.employeeId.toLowerCase().includes(q)) ||
        (cleanQ.length > 0 && cleanId.includes(cleanQ)) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        (cleanPhoneQ.length > 0 && cleanPhone.includes(cleanPhoneQ)) ||
        (item.department && item.department.toLowerCase().includes(q)) ||
        (item.joiningDate && item.joiningDate.toLowerCase().includes(q));

      const matchesFace =
        faceStatusFilter === 'All' ||
        (faceStatusFilter === 'Mapped' && Boolean(item.photoUri)) ||
        (faceStatusFilter === 'Pending' && !item.photoUri);
      return matchesDept && matchesSearch && matchesFace;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'id') return a.employeeId.localeCompare(b.employeeId);
      if (sortBy === 'recent') {
        const dA = a.joiningDate ? new Date(a.joiningDate).getTime() : 0;
        const dB = b.joiningDate ? new Date(b.joiningDate).getTime() : 0;
        return dB - dA;
      }
      return 0;
    });

  const addTranslateY = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -198],
  });

  const exportTranslateY = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -132],
  });

  const emailTranslateY = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -66],
  });

  const rotationData = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Title */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View>
            {orgAccount.isLoggedIn && Boolean(orgAccount.orgId) && (
              <View style={styles.companyBadgeRow}>
                <FontAwesome name="building" size={12} color="#FF6900" style={{ marginRight: 5 }} />
                <Text style={styles.companyNameText} numberOfLines={1}>
                  {orgAccount.companyName || deriveCompanyName(orgAccount.orgEmail, orgAccount.orgId)}
                </Text>
              </View>
            )}
            <Text style={styles.headerTitle}>Enrolment</Text>
            <View style={styles.headerUnderline} />
          </View>
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
            <FontAwesome name="lock" size={13} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar with Expandable Filter Icon */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchAndFilterRow}>
          <Pressable
            style={[styles.searchBox, isSearchFocused && styles.searchBoxFocused]}
            onPress={() => searchInputRef.current?.focus()}
          >
            <FontAwesome
              name="search"
              size={13}
              color={searchQuery || isSearchFocused ? THEME_COLOR : '#94A3B8'}
              style={{ marginRight: 8 }}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search name, ID, phone, dept..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              selectionColor={THEME_COLOR}
              cursorColor={THEME_COLOR}
              editable={true}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <FontAwesome name="times-circle" size={15} color="#64748B" />
              </TouchableOpacity>
            )}
          </Pressable>

          <TouchableOpacity
            style={[
              styles.filterToggleBtn,
              isFilterExpanded && styles.filterToggleBtnActive,
              hasActiveFilters && styles.filterToggleBtnHasFilter,
            ]}
            onPress={() => setIsFilterExpanded(!isFilterExpanded)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={18}
              color={hasActiveFilters ? '#FFFFFF' : isFilterExpanded ? THEME_COLOR : '#475569'}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadgeCount}>
                <Text style={styles.filterBadgeCountText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Compact summary when collapsed & active */}
        {!isFilterExpanded && hasActiveFilters && (
          <View style={styles.activeFilterSummaryBar}>
            <MaterialCommunityIcons name="filter-check" size={12} color={THEME_COLOR} style={{ marginRight: 4 }} />
            <Text style={styles.activeFilterSummaryText} numberOfLines={1}>
              {[selectedDept !== 'All' ? `Dept: ${selectedDept}` : null, faceStatusFilter !== 'All' ? `${faceStatusFilter} Face` : null, sortBy !== 'name' ? `Sorted: ${sortBy}` : null].filter(Boolean).join(' · ')}
            </Text>
            <TouchableOpacity onPress={handleResetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={14} color="#94A3B8" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* Expandable Filter Drawer */}
        {isFilterExpanded && (
          <View style={styles.expandableFilterCard}>
            <View style={styles.filterCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="tune-variant" size={13} color={THEME_COLOR} style={{ marginRight: 4 }} />
                <Text style={styles.filterCardHeading}>FILTERS & SORTING</Text>
              </View>
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleResetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.filterResetLink}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Department Section */}
            <Text style={styles.filterGroupTitle}>DEPARTMENT</Text>
            <View style={styles.pillsWrapRow}>
              {DEPT_FILTER_LIST.map((dept) => {
                const isSelected = selectedDept === dept;
                const count = dept === 'All' ? enrolledEmployees.length : enrolledEmployees.filter((e) => e.department === dept).length;
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.compactPill, isSelected ? styles.compactPillActive : styles.compactPillInactive]}
                    onPress={() => setSelectedDept(dept as Department)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.compactPillText, isSelected ? styles.compactPillTextActive : styles.compactPillTextInactive]}>
                      {dept}
                    </Text>
                    <View style={[styles.compactCountBadge, isSelected ? styles.compactCountActive : styles.compactCountInactive]}>
                      <Text style={[styles.compactCountText, isSelected ? styles.compactCountTextActive : styles.compactCountTextInactive]}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Face Mapping Status Section */}
            <Text style={[styles.filterGroupTitle, { marginTop: 10 }]}>FACE MAPPING</Text>
            <View style={styles.pillsWrapRow}>
              <TouchableOpacity
                style={[styles.compactPill, faceStatusFilter === 'All' && styles.compactPillActive]}
                onPress={() => setFaceStatusFilter('All')}
                activeOpacity={0.75}
              >
                <Text style={[styles.compactPillText, faceStatusFilter === 'All' && styles.compactPillTextActive]}>
                  All ({enrolledEmployees.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.compactPill, faceStatusFilter === 'Mapped' && styles.compactPillActive]}
                onPress={() => setFaceStatusFilter('Mapped')}
                activeOpacity={0.75}
              >
                <FontAwesome name="check-circle" size={10} color={faceStatusFilter === 'Mapped' ? '#FFFFFF' : '#10B981'} style={{ marginRight: 4 }} />
                <Text style={[styles.compactPillText, faceStatusFilter === 'Mapped' && styles.compactPillTextActive]}>
                  Mapped ({enrolledEmployees.filter((e) => Boolean(e.photoUri)).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.compactPill, faceStatusFilter === 'Pending' && styles.compactPillActive]}
                onPress={() => setFaceStatusFilter('Pending')}
                activeOpacity={0.75}
              >
                <FontAwesome name="exclamation-circle" size={10} color={faceStatusFilter === 'Pending' ? '#FFFFFF' : '#F59E0B'} style={{ marginRight: 4 }} />
                <Text style={[styles.compactPillText, faceStatusFilter === 'Pending' && styles.compactPillTextActive]}>
                  Pending ({enrolledEmployees.filter((e) => !e.photoUri).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sort Order Section */}
            <Text style={[styles.filterGroupTitle, { marginTop: 10 }]}>SORT ORDER</Text>
            <View style={styles.pillsWrapRow}>
              {(
                [
                  { id: 'name', label: 'Name (A-Z)' },
                  { id: 'id', label: 'ID' },
                  { id: 'recent', label: 'Recent' },
                ] as const
              ).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.compactPill, sortBy === s.id && styles.compactPillActive]}
                  onPress={() => setSortBy(s.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.compactPillText, sortBy === s.id && styles.compactPillTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* List View */}
      <View style={styles.listContainer}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionSubTitle} numberOfLines={1}>
            {searchQuery
              ? `Results for "${searchQuery}" (${filteredList.length})`
              : selectedDept === 'All'
              ? `All Employees (${filteredList.length})`
              : `${selectedDept} Department (${filteredList.length})`}
          </Text>
          <TouchableOpacity onPress={handleOpenAddModal} style={styles.quickAddBtn}>
            <FontAwesome name="plus" size={12} color="#FF6900" style={{ marginRight: 4 }} />
            <Text style={styles.quickAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {filteredList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-search-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Employees Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No employees matching "${searchQuery}". Try a different name, ID, or phone.`
                : `No employees registered in ${selectedDept}.`}
            </Text>
            {searchQuery ? (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setSearchQuery('')}
                activeOpacity={0.8}
              >
                <FontAwesome name="times" size={11} color={THEME_COLOR} style={{ marginRight: 6 }} />
                <Text style={styles.clearSearchBtnText}>Clear Search</Text>
              </TouchableOpacity>
            ) : hasActiveFilters ? (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={handleResetFilters}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="filter-remove-outline" size={13} color={THEME_COLOR} style={{ marginRight: 6 }} />
                <Text style={styles.clearSearchBtnText}>Reset All Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            renderItem={({ item }) => (
              <View style={styles.employeeCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardAvatarCircle}>
                    <FontAwesome name="user" size={16} color="#FF6900" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10, overflow: 'hidden' }}>
                    <Text style={styles.cardEmpName} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.cardEmpIdBadge} numberOfLines={1}>{item.employeeId}</Text>
                      <View style={styles.cardDeptBadge}>
                        <Text style={styles.cardDeptBadgeText} numberOfLines={1}>{item.department || 'General'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      style={styles.iconEditButton}
                      onPress={() => handleOpenEditModal(item)}
                    >
                      <FontAwesome name="pencil" size={13} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconDeleteButton}
                      onPress={() => handleDeleteEnrolment(item.id, item.name)}
                    >
                      <FontAwesome name="trash" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sub info row: Phone, Date, Face mapping status */}
                <View style={styles.cardDetailsRow}>
                  <View style={styles.detailTag}>
                    <FontAwesome name="phone" size={11} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.detailTagText} numberOfLines={1}>{item.phone}</Text>
                  </View>

                  {item.joiningDate && (
                    <View style={styles.detailTag}>
                      <FontAwesome name="calendar" size={10} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.detailTagText} numberOfLines={1}>{item.joiningDate}</Text>
                    </View>
                  )}

                  <View style={[styles.faceMappedBadge, { backgroundColor: item.photoUri ? '#ECFDF5' : '#FFF7ED', borderColor: item.photoUri ? '#A7F3D0' : '#FED7AA' }]}>
                    <MaterialCommunityIcons
                      name={item.photoUri ? 'face-recognition' : 'face-man-shimmer-outline'}
                      size={12}
                      color={item.photoUri ? '#059669' : '#C2410C'}
                      style={{ marginRight: 3 }}
                    />
                    <Text style={[styles.faceMappedText, { color: item.photoUri ? '#059669' : '#C2410C' }]} numberOfLines={1}>
                      {item.photoUri ? 'Face Mapped' : 'Pending Face'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Vertical Collapsible Floating Action Dock */}
      <View style={styles.bottomDockContainer}>
        <Animated.View style={[styles.absoluteActionFab, { transform: [{ translateY: addTranslateY }] }]}>
          <TouchableOpacity style={styles.innerFab} onPress={handleOpenAddModal} activeOpacity={0.85}>
            <FontAwesome name="plus" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.absoluteActionFab, { transform: [{ translateY: exportTranslateY }] }]}>
          <TouchableOpacity style={styles.innerFab} onPress={handleExportCsv} activeOpacity={0.85}>
            <MaterialCommunityIcons name="file-export" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.absoluteActionFab, { transform: [{ translateY: emailTranslateY }] }]}>
          <TouchableOpacity style={styles.innerFab} onPress={handleShareViaEmail} activeOpacity={0.85}>
            <FontAwesome name="envelope" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Main Toggle Button */}
        <TouchableOpacity style={styles.mainToggleFab} onPress={toggleDock} activeOpacity={0.9}>
          <Animated.View style={{ transform: [{ rotate: rotationData }] }}>
            <FontAwesome name="plus" size={20} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Enrolment Form Modal (Add / Edit) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContentContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {editingId ? 'Edit Enrolment' : 'New Enrolment'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <FontAwesome name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Employee ID {editingId ? '' : '*'}</Text>
                <TextInput
                  style={[styles.input, editingId ? styles.disabledInput : null]}
                  value={formData.employeeId}
                  editable={!editingId}
                  placeholder="e.g. BR-030"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  onChangeText={(text) => handleInputChange('employeeId', text)}
                />
                {!editingId && (
                  <Text style={styles.inputHint}>You can customize the Employee ID before saving.</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter employee name"
                  placeholderTextColor="#9CA3AF"
                  value={formData.name}
                  onChangeText={(text) => handleInputChange('name', text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Department *</Text>
                <View style={styles.deptGridWrap}>
                  {contextDepts.map((dept) => {
                    const isActive = formData.department === dept;
                    const deptMeta: Record<string, { icon: string; color: string; bg: string }> = {
                      'Engineering':  { icon: 'cog',              color: '#2563EB', bg: '#EFF6FF' },
                      'HR & Admin':   { icon: 'account-tie',      color: '#7C3AED', bg: '#F5F3FF' },
                      'Design':       { icon: 'palette',          color: '#DB2777', bg: '#FDF2F8' },
                      'Marketing':    { icon: 'bullhorn',         color: '#D97706', bg: '#FFFBEB' },
                      'Finance':      { icon: 'currency-usd',     color: '#059669', bg: '#ECFDF5' },
                      'Operations':   { icon: 'clipboard-list',   color: '#0284C7', bg: '#F0F9FF' },
                    };
                    const meta = deptMeta[dept] ?? { icon: 'briefcase', color: '#64748B', bg: '#F8FAFC' };
                    return (
                      <TouchableOpacity
                        key={dept}
                        style={[
                          styles.deptGridCard,
                          isActive && { backgroundColor: '#FF6900', borderColor: '#FF6900' },
                          !isActive && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                        ]}
                        onPress={() => handleInputChange('department', dept)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.deptGridIcon, isActive ? { backgroundColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: meta.bg }]}>
                          <MaterialCommunityIcons
                            name={meta.icon as any}
                            size={16}
                            color={isActive ? '#FFFFFF' : meta.color}
                          />
                        </View>
                        <Text style={[styles.deptGridLabel, isActive && styles.deptGridLabelActive]}>
                          {dept}
                        </Text>
                        {isActive && (
                          <MaterialCommunityIcons name="check-circle" size={13} color="rgba(255,255,255,0.9)" style={{ marginTop: 3 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={formData.phone}
                  onChangeText={(text) => handleInputChange('phone', text)}
                />
              </View>

              {/* Joining Date Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Joining Date</Text>
                <TouchableOpacity
                  style={styles.datePickerInput}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.datePickerInputText}>
                    {formData.joiningDate.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <FontAwesome name="calendar" size={15} color={THEME_COLOR} />
                </TouchableOpacity>
              </View>

              {/* Face Capture Section */}
              <TouchableOpacity 
                style={styles.faceCaptureButton} 
                activeOpacity={0.8}
                onPress={() => {
                  if (!permission || !permission.granted) {
                    requestPermission();
                  }
                  setCameraVisible(true);
                }}
              >
                <FontAwesome name="camera" size={18} color={THEME_COLOR} style={{ marginRight: 8 }} />
                <Text style={styles.faceCaptureText}>
                  {capturedPhoto ? 'Retake Photo' : 'Capture Face (Biometric Mapping)'}
                </Text>
              </TouchableOpacity>

              {capturedPhoto && (
                <View style={styles.successCaptureTag}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.successCaptureText}>Face mapping successfully registered</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitButton} onPress={handleEnrolment} activeOpacity={0.85}>
                <Text style={styles.submitButtonText}>
                  {editingId ? 'Save Changes' : 'Complete Enrolment'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal for Joining Date */}
      <AppDateTimePicker
        visible={showDatePicker}
        value={formData.joiningDate}
        mode="date"
        title="Select Joining Date"
        themeColor={THEME_COLOR}
        onChange={(selectedDate) => {
          setFormData({ ...formData, joiningDate: selectedDate });
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Camera Modal for Photo Capture & Face Detection (Full Screen) */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        statusBarTranslucent={true}
        presentationStyle="fullScreen"
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={true} />
          {/* CameraView full screen */}
          {cameraVisible && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="front"
              mode="picture"
              animateShutter={false}
              ref={cameraRef}
            />
          )}

          {/* Absolute Positioned Overlay UI */}
          <SafeAreaView style={styles.cameraOverlayContainer} pointerEvents="box-none">
            {/* Header */}
            <View style={styles.cameraHeader}>
              <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.closeCameraButton}>
                <FontAwesome name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.cameraTitleBadge}>
                <MaterialCommunityIcons name="face-recognition" size={16} color="#FF6900" style={{ marginRight: 6 }} />
                <Text style={styles.cameraTitle}>Face Enrolment</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Centered Face Detection Guide Reticle */}
            <View style={styles.reticleWrapper} pointerEvents="none">
              <View style={styles.reticleBox}>
                {/* 4 Corners */}
                <View style={[styles.camCorner, styles.camCornerTL]} />
                <View style={[styles.camCorner, styles.camCornerTR]} />
                <View style={[styles.camCorner, styles.camCornerBL]} />
                <View style={[styles.camCorner, styles.camCornerBR]} />
              </View>
              <Text style={styles.reticleHintText}>Align face clearly within corners</Text>
            </View>

            {/* Footer with capture shutter button */}
            <View style={styles.cameraFooter}>
              <TouchableOpacity style={styles.captureButtonOuter} onPress={handleCapturePhoto} activeOpacity={0.8}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <Text style={styles.captureLabel}>TAP TO CAPTURE</Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  companyNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME_COLOR,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: 0.3,
  },
  headerUnderline: {
    width: 32,
    height: 3,
    backgroundColor: THEME_COLOR,
    marginTop: 4,
    borderRadius: 2,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  lockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  searchBoxFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFFFFF',
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    height: 44,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterToggleBtnActive: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFF7ED',
  },
  filterToggleBtnHasFilter: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
  },
  filterBadgeCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  filterBadgeCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  activeFilterSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  activeFilterSummaryText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  expandableFilterCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterCardHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  filterResetLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  filterGroupTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  pillsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  compactPillActive: {
    borderColor: THEME_COLOR,
    backgroundColor: THEME_COLOR,
  },
  compactPillInactive: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  compactPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  compactPillTextActive: {
    color: '#FFFFFF',
  },
  compactPillTextInactive: {
    color: '#475569',
  },
  compactCountBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 4,
  },
  compactCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  compactCountInactive: {
    backgroundColor: '#E2E8F0',
  },
  compactCountText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  compactCountTextActive: {
    color: '#FFFFFF',
  },
  compactCountTextInactive: {
    color: '#64748B',
  },
  // Department grid selector in modal
  deptGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  deptGridCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  deptGridIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptGridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  deptGridLabelActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionSubTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quickAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6900',
  },
  scrollContent: {
    paddingBottom: 90,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 14,
  },
  clearSearchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME_COLOR,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmpName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardEmpIdBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6900',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  cardDeptBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  cardDeptBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconEditButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailTagText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  faceMappedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  faceMappedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bottomDockContainer: {
    position: 'absolute',
    bottom: 25,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  mainToggleFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  absoluteActionFab: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  innerFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  disabledInput: {
    backgroundColor: '#F8FAFC',
    color: '#64748B',
    fontWeight: '700',
  },
  inputHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  formDeptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formDeptChipActive: {
    backgroundColor: '#FF6900',
    borderColor: '#FF6900',
  },
  formDeptChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  formDeptChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  datePickerInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  datePickerInputText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  faceCaptureButton: {
    flexDirection: 'row',
    backgroundColor: THEME_COLOR_10_OPACITY,
    borderWidth: 1.5,
    borderColor: THEME_COLOR,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  faceCaptureText: {
    color: THEME_COLOR,
    fontSize: 13,
    fontWeight: '700',
  },
  successCaptureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  successCaptureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  submitButton: {
    backgroundColor: THEME_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cameraModalContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  cameraOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  closeCameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 0, 0.5)',
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reticleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 220,
    height: 250,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 105, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  camCorner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#FF6900',
    borderWidth: 3.5,
  },
  camCornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  camCornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  camCornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  camCornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },
  scanningLaser: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#FF6900',
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  reticleCenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6900',
  },
  reticleHintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  cameraFooter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButtonOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: THEME_COLOR,
  },
  captureLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
  },
});