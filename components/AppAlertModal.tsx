import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AppAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AppAlertButton[];
  onClose: () => void;
}

const THEME_COLOR = '#FF6900';

export default function AppAlertModal({
  visible,
  title,
  message,
  buttons,
  onClose,
}: AppAlertModalProps) {
  const isError = title.toLowerCase().includes('error');
  const isSuccess = title.toLowerCase().includes('success');
  const isWarning = title.toLowerCase().includes('duplicate') || title.toLowerCase().includes('delete') || title.toLowerCase().includes('notice');
  
  let headerIconName = 'info-circle';
  let headerIconColor = THEME_COLOR;

  if (isError) {
    headerIconName = 'times-circle';
    headerIconColor = '#EF4444';
  } else if (isSuccess) {
    headerIconName = 'check-circle';
    headerIconColor = '#10B981';
  } else if (isWarning) {
    headerIconName = 'exclamation-circle';
    headerIconColor = '#F59E0B';
  }

  const renderButtons = () => {
    if (!buttons || buttons.length === 0) {
      return (
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onClose}>
          <Text style={styles.primaryButtonText}>OK</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.buttonsContainer}>
        {buttons.map((btn, index) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          
          let buttonStyle = styles.primaryButton;
          let textStyle = styles.primaryButtonText;
          
          if (isCancel) {
            buttonStyle = styles.cancelButton;
            textStyle = styles.cancelButtonText;
          } else if (isDestructive) {
            buttonStyle = styles.destructiveButton;
            textStyle = styles.destructiveButtonText;
          }
          
          return (
            <TouchableOpacity
              key={index}
              style={[styles.button, buttonStyle, buttons.length > 1 && { flex: 1, marginHorizontal: 4 }]}
              onPress={() => {
                if (btn.onPress) btn.onPress();
                onClose();
              }}
            >
              <Text style={textStyle}>{btn.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.alertBox}>
              <View style={styles.header}>
                <FontAwesome name={headerIconName as any} size={24} color={headerIconColor} style={styles.icon} />
                <Text style={styles.title}>{title}</Text>
              </View>
              <Text style={styles.message}>{message}</Text>
              {renderButtons()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  message: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  primaryButton: {
    backgroundColor: THEME_COLOR,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  destructiveButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  destructiveButtonText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
});
