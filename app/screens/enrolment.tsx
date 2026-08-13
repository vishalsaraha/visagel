import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';

export default function EnrolmentScreen() {
  const [formData, setFormData] = useState({
    serialNo: 'BR-027',
    name: '',
    email: '',
    phone: '',
    department: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleEnrolment = () => {
    if (!formData.name || !formData.phone) {
      Alert.alert('Error', 'Please fill in all mandatory fields.');
      return;
    }
    Alert.alert('Success', `Successfully enrolled ${formData.name}!`);
    setFormData({
      serialNo: 'BR-028',
      name: '',
      email: '',
      phone: '',
      department: '',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>User Enrolment</Text>
        <View style={styles.headerUnderline} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionSubTitle}>Register New Face Attendance Profile</Text>

        {/* Form Fields */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Serial Number</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.serialNo}
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
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter email address"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) => handleInputChange('email', text)}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Department</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Engineering, Design"
            placeholderTextColor="#9CA3AF"
            value={formData.department}
            onChangeText={(text) => handleInputChange('department', text)}
          />
        </View>

        {/* Face Capture Section */}
        <TouchableOpacity style={styles.faceCaptureButton} activeOpacity={0.8}>
          <FontAwesome name="camera" size={20} color="#FF6900" style={{ marginRight: 8 }} />
          <Text style={styles.faceCaptureText}>Capture Face Data</Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleEnrolment} activeOpacity={0.85}>
          <Text style={styles.submitButtonText}>Complete Enrolment</Text>
        </TouchableOpacity>
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
  sectionSubTitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
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
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  faceCaptureButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 105, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6900',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  faceCaptureText: {
    color: '#FF6900',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF6900',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});