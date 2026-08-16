import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';

interface AuthPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  verifyPin: (pin: string) => boolean;
  title?: string;
  subtitle?: string;
}

export default function AuthPinModal({
  visible,
  onClose,
  onSuccess,
  verifyPin,
  title = 'HR Admin Verification',
  subtitle = 'Enter 4-digit security PIN to access HR tools',
}: AuthPinModalProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setPin('');
      setErrorMessage('');
    }
  }, [visible]);

  const handlePressKey = (val: string) => {
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      setErrorMessage('');

      if (nextPin.length === 4) {
        // Auto-check PIN
        setTimeout(() => {
          if (verifyPin(nextPin)) {
            setPin('');
            setErrorMessage('');
            onSuccess();
          } else {
            Vibration.vibrate(100);
            setErrorMessage('Incorrect PIN. Please try again.');
            setPin('');
          }
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
    }
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage('');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <FontAwesome name="close" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* Security Badge Icon */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-key" size={32} color="#FF6900" />
          </View>

          {/* Titles */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* PIN Dots Display */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isFilled && styles.dotFilled,
                    errorMessage ? styles.dotError : null,
                  ]}
                />
              );
            })}
          </View>

          {/* Error feedback */}
          <View style={styles.errorContainer}>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : (
              <Text style={styles.hintText}>Default PIN: 1234</Text>
            )}
          </View>

          {/* Number Pad Grid */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((key) => {
                  if (key === 'C') {
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.keyButton, styles.funcKeyButton]}
                        onPress={handleClear}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.funcKeyText}>CLEAR</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (key === '⌫') {
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.keyButton, styles.funcKeyButton]}
                        onPress={handleBackspace}
                        activeOpacity={0.6}
                      >
                        <MaterialCommunityIcons name="backspace-outline" size={24} color="#64748B" />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.keyButton}
                      onPress={() => handlePressKey(key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keyText}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: '#FF6900',
    backgroundColor: '#FF6900',
    transform: [{ scale: 1.1 }],
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorContainer: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  keypad: {
    width: '100%',
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  funcKeyButton: {
    backgroundColor: '#F1F5F9',
  },
  funcKeyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
});
