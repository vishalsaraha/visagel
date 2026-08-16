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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import AppDateTimePicker from '@/components/AppDateTimePicker';

const THEME_COLOR = '#FF6900';
const THEME_COLOR_10_OPACITY = 'rgba(255, 105, 0, 0.1)';

interface EnrolmentItem {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  joiningDate: string;
  photoUri: string | null;
}

export default function EnrolmentScreen() {
  const [enrolmentList, setEnrolmentList] = useState<EnrolmentItem[]>([
    {
      id: '1',
      employeeId: 'BR-026',
      name: 'John Doe',
      phone: '9876543210',
      joiningDate: '2026-08-01',
      photoUri: null,
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    employeeId: 'BR-027',
    name: '',
    phone: '',
    joiningDate: new Date(),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

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
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        if (photo && photo.uri) {
          setCapturedPhoto(photo.uri);
          setCameraVisible(false);
        }
      } catch {
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      employeeId: `BR-0${27 + enrolmentList.length}`,
      name: '',
      phone: '',
      joiningDate: new Date(),
    });
    setCapturedPhoto(null);
    setModalVisible(true);
    toggleDock();
  };

  const handleOpenEditModal = (item: EnrolmentItem) => {
    setEditingId(item.id);
    const parsedDate = item.joiningDate ? new Date(item.joiningDate) : new Date();
    setFormData({
      employeeId: item.employeeId,
      name: item.name,
      phone: item.phone,
      joiningDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    });
    setCapturedPhoto(item.photoUri);
    setModalVisible(true);
  };

  const handleDeleteEnrolment = (id: string, name: string) => {
    Alert.alert(
      'Delete Enrolment',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setEnrolmentList(enrolmentList.filter((item) => item.id !== id));
            Alert.alert('Deleted', 'Enrolment record removed successfully.');
          },
        },
      ]
    );
  };

  const handleEnrolment = () => {
    if (!formData.name || !formData.phone) {
      Alert.alert('Error', 'Please fill in Employee Name and Phone Number.');
      return;
    }

    const joiningDateStr = formData.joiningDate.toISOString().split('T')[0];

    if (editingId) {
      setEnrolmentList(
        enrolmentList.map((item) =>
          item.id === editingId
            ? {
                ...item,
                name: formData.name,
                phone: formData.phone,
                joiningDate: joiningDateStr,
                photoUri: capturedPhoto,
              }
            : item
        )
      );
      Alert.alert('Success', `Successfully updated ${formData.name}!`);
    } else {
      const newEnrolment: EnrolmentItem = {
        id: Date.now().toString(),
        employeeId: formData.employeeId,
        name: formData.name,
        phone: formData.phone,
        joiningDate: joiningDateStr,
        photoUri: capturedPhoto,
      };

      setEnrolmentList([newEnrolment, ...enrolmentList]);
      Alert.alert('Success', `Successfully enrolled ${formData.name} (${formData.employeeId})!`);
    }

    setModalVisible(false);
    setEditingId(null);
    setCapturedPhoto(null);
  };

  const generateCsvFile = async (): Promise<string | null> => {
    try {
      let csvHeader = 'Employee ID,Full Name,Phone Number,Joining Date,Face Mapped\n';
      let csvRows = enrolmentList
        .map(
          (item) =>
            `"${item.employeeId}","${item.name}","${item.phone}","${item.joiningDate || 'N/A'}","${item.photoUri ? 'Yes' : 'No'}"`
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
      Alert.alert('Error', 'Failed to generate CSV file.');
      return null;
    }
  };

  const handleExportCsv = async () => {
    toggleDock();
    if (enrolmentList.length === 0) {
      Alert.alert('Notice', 'No enrolment records available to export.');
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
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    }
  };

  const handleShareViaEmail = async () => {
    toggleDock();
    if (enrolmentList.length === 0) {
      Alert.alert('Notice', 'No enrolment records available to send.');
      return;
    }

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Error', 'Email composition is not available on this device.');
      return;
    }

    const fileUri = await generateCsvFile();
    if (fileUri) {
      await MailComposer.composeAsync({
        subject: 'Employee Enrolment Records Report',
        body: 'Please find attached the latest employee enrolment records export.',
        attachments: [fileUri],
      });
    }
  };

  // Increased vertical distances to completely eliminate overlapping (Spacing: 66px per step)
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
            <Text style={styles.headerTitle}>Employee Enrolment</Text>
            <View style={styles.headerUnderline} />
          </View>
        </View>
      </View>

      {/* List View */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionSubTitle}>Enrolled Employees ({enrolmentList.length})</Text>
        <FlatList
          data={enrolmentList}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          renderItem={({ item, index }) => (
            <View style={styles.rowItemContainer}>
              <View style={styles.rowItemLeft}>
                <Text style={styles.rowIndex}>{index + 1}</Text>
                <View style={styles.rowDetails}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowEmployeeId}>{item.employeeId}</Text>
                  </View>
                  <View style={styles.rowSubLine}>
                    <Text style={styles.rowPhone}>
                      <FontAwesome name="phone" size={11} color="#6B7280" /> {item.phone}
                    </Text>
                    {item.joiningDate && (
                      <View style={styles.rowDateTag}>
                        <FontAwesome name="calendar" size={10} color="#6B7280" style={{ marginRight: 3 }} />
                        <Text style={styles.rowDateText}>{item.joiningDate}</Text>
                      </View>
                    )}
                    {item.photoUri && (
                      <View style={styles.miniFaceTag}>
                        <FontAwesome name="camera" size={10} color={THEME_COLOR} style={{ marginRight: 3 }} />
                        <Text style={styles.miniFaceText}>Mapped</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* CRUD Action Buttons */}
              <View style={styles.rowActionButtons}>
                <TouchableOpacity
                  style={styles.iconEditButton}
                  onPress={() => handleOpenEditModal(item)}
                >
                  <FontAwesome name="pencil" size={14} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconDeleteButton}
                  onPress={() => handleDeleteEnrolment(item.id, item.name)}
                >
                  <FontAwesome name="trash" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
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
                {editingId ? 'Edit Employee Enrolment' : 'New Employee Enrolment'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <FontAwesome name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Employee ID</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={formData.employeeId}
                  editable={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter full name"
                  placeholderTextColor="#9CA3AF"
                  value={formData.name}
                  onChangeText={(text) => handleInputChange('name', text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
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
                  <FontAwesome name="calendar" size={16} color={THEME_COLOR} />
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
                <FontAwesome name="camera" size={20} color={THEME_COLOR} style={{ marginRight: 8 }} />
                <Text style={styles.faceCaptureText}>
                  {capturedPhoto ? 'Retake Face Photo' : 'Capture & Map Face Data'}
                </Text>
              </TouchableOpacity>

              {capturedPhoto && (
                <View style={styles.successCaptureTag}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={THEME_COLOR} style={{ marginRight: 6 }} />
                  <Text style={styles.successCaptureText}>Face Photo Captured Successfully</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitButton} onPress={handleEnrolment} activeOpacity={0.85}>
                <Text style={styles.submitButtonText}>
                  {editingId ? 'Update Enrolment' : 'Complete Enrolment'}
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

      {/* Camera Modal for Photo Capture */}
      <Modal visible={cameraVisible} animationType="slide" onRequestClose={() => setCameraVisible(false)}>
        <View style={styles.cameraModalContainer}>
          <CameraView style={styles.cameraView} facing="front" ref={cameraRef}>
            <SafeAreaView style={styles.cameraOverlayContainer}>
              <View style={styles.cameraHeader}>
                <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.closeCameraButton}>
                  <FontAwesome name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.cameraTitle}>Position Face in Frame</Text>
                <View style={{ width: 40 }} />
              </View>

              <View style={styles.cameraFooter}>
                <TouchableOpacity style={styles.captureButtonOuter} onPress={handleCapturePhoto}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A192F',
  },
  headerUnderline: {
    width: 30,
    height: 3,
    backgroundColor: THEME_COLOR,
    marginTop: 6,
    borderRadius: 2,
  },
  bottomDockContainer: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  mainToggleFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  absoluteActionFab: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  innerFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 70,
  },
  sectionSubTitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  rowItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  rowItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowIndex: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    width: 24,
  },
  rowDetails: {
    flex: 1,
    marginLeft: 6,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingRight: 10,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  rowEmployeeId: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME_COLOR,
    backgroundColor: THEME_COLOR_10_OPACITY,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rowSubLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowPhone: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 10,
  },
  miniFaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLOR_10_OPACITY,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miniFaceText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME_COLOR,
  },
  rowActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconEditButton: {
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
    marginRight: 6,
  },
  iconDeleteButton: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A192F',
  },
  modalCloseButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  datePickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerInputText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  rowDateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
  },
  rowDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  faceCaptureButton: {
    flexDirection: 'row',
    backgroundColor: THEME_COLOR_10_OPACITY,
    borderWidth: 1,
    borderColor: THEME_COLOR,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  faceCaptureText: {
    color: THEME_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  successCaptureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLOR_10_OPACITY,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  successCaptureText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME_COLOR,
  },
  submitButton: {
    backgroundColor: THEME_COLOR,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeCameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraFooter: {
    alignItems: 'center',
    marginBottom: 30,
  },
  captureButtonOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME_COLOR,
  },
});