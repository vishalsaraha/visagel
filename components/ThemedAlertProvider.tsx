import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';

export interface ThemedAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface ThemedAlertOptions {
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  buttons?: ThemedAlertButton[];
}

interface ThemedAlertContextType {
  showAlert: (options: ThemedAlertOptions) => void;
  alert: (
    title: string,
    message?: string,
    buttons?: ThemedAlertButton[],
    type?: 'info' | 'success' | 'warning' | 'error' | 'confirm'
  ) => void;
}

const ThemedAlertContext = createContext<ThemedAlertContextType | null>(null);

let globalAlertHandler: ((options: ThemedAlertOptions) => void) | null = null;

/**
 * Global imperatively callable helper so any file can import `ThemedAlert` directly:
 * ThemedAlert.alert('Title', 'Message', [{ text: 'OK', onPress: () => {} }])
 */
export const ThemedAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: ThemedAlertButton[],
    type?: 'info' | 'success' | 'warning' | 'error' | 'confirm'
  ) => {
    if (globalAlertHandler) {
      globalAlertHandler({
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
        type: type || (title.toLowerCase().includes('error') || title.toLowerCase().includes('fail') ? 'error' : title.toLowerCase().includes('success') ? 'success' : 'info'),
      });
    } else {
      console.warn('ThemedAlertProvider not mounted yet');
    }
  },
};

export const useThemedAlert = () => {
  const ctx = useContext(ThemedAlertContext);
  if (!ctx) {
    throw new Error('useThemedAlert must be used within a ThemedAlertProvider');
  }
  return ctx;
};

export const ThemedAlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ThemedAlertOptions | null>(null);
  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  const closeAlert = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
    });
  }, [scaleAnim, opacityAnim]);

  const showAlert = useCallback(
    (options: ThemedAlertOptions) => {
      setConfig(options);
      setVisible(true);
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    },
    [scaleAnim, opacityAnim]
  );

  const alertHelper = useCallback(
    (
      title: string,
      message?: string,
      buttons?: ThemedAlertButton[],
      type?: 'info' | 'success' | 'warning' | 'error' | 'confirm'
    ) => {
      let inferredType = type;
      if (!inferredType) {
        const lower = (title + ' ' + (message || '')).toLowerCase();
        if (lower.includes('error') || lower.includes('fail') || lower.includes('delete') || lower.includes('invalid')) {
          inferredType = 'error';
        } else if (lower.includes('success') || lower.includes('saved') || lower.includes('complete')) {
          inferredType = 'success';
        } else if (lower.includes('warning') || lower.includes('caution') || lower.includes('confirm')) {
          inferredType = 'warning';
        } else {
          inferredType = 'info';
        }
      }
      showAlert({
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
        type: inferredType,
      });
    },
    [showAlert]
  );

  React.useEffect(() => {
    globalAlertHandler = showAlert;
    return () => {
      if (globalAlertHandler === showAlert) {
        globalAlertHandler = null;
      }
    };
  }, [showAlert]);

  const getIconInfo = (type?: string) => {
    switch (type) {
      case 'success':
        return { name: 'check-circle-outline', color: '#10B981', bg: '#ECFDF5', titleColor: '#065F46' };
      case 'error':
        return { name: 'alert-circle-outline', color: '#EF4444', bg: '#FEF2F2', titleColor: '#991B1B' };
      case 'warning':
        return { name: 'alert-outline', color: '#F59E0B', bg: '#FFFBEB', titleColor: '#92400E' };
      default:
        return { name: 'information-outline', color: '#FF6900', bg: '#FFF7ED', titleColor: '#060F1E' };
    }
  };

  const currentIcon = getIconInfo(config?.type);
  const buttons = config?.buttons && config.buttons.length > 0 ? config.buttons : [{ text: 'OK', style: 'default' as const }];

  return (
    <ThemedAlertContext.Provider value={{ showAlert, alert: alertHelper }}>
      {children}
      <Modal visible={visible} transparent animationType="none" onRequestClose={closeAlert}>
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.dialogCard,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Ambient accent top pill */}
            <View style={[styles.topPill, { backgroundColor: currentIcon.color }]} />

            <View style={styles.dialogContent}>
              {/* Icon badge */}
              <View style={[styles.iconCircle, { backgroundColor: currentIcon.bg }]}>
                <MaterialCommunityIcons name={currentIcon.name as any} size={36} color={currentIcon.color} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: currentIcon.titleColor }]}>{config?.title || 'Notice'}</Text>

              {/* Message */}
              {config?.message ? <Text style={styles.message}>{config.message}</Text> : null}

              {/* Action Buttons */}
              <View
                style={[
                  styles.buttonContainer,
                  buttons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainerHorizontal,
                ]}
              >
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  const isDefault = !isCancel && !isDestructive;

                  let btnStyle: any = styles.defaultButton;
                  let textStyle: any = styles.defaultButtonText;

                  if (isCancel) {
                    btnStyle = styles.cancelButton;
                    textStyle = styles.cancelButtonText;
                  } else if (isDestructive) {
                    btnStyle = styles.destructiveButton;
                    textStyle = styles.destructiveButtonText;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.btnBase, btnStyle, buttons.length <= 2 && { flex: 1 }]}
                      activeOpacity={0.82}
                      onPress={() => {
                        closeAlert();
                        if (btn.onPress) {
                          setTimeout(() => {
                            btn.onPress?.();
                          }, 150);
                        }
                      }}
                    >
                      <Text style={[styles.btnTextBase, textStyle]}>{btn.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ThemedAlertContext.Provider>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 15, 30, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: Math.min(width - 48, 380),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  topPill: {
    height: 4,
    width: '100%',
  },
  dialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  buttonContainerHorizontal: {
    flexDirection: 'row',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  btnBase: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextBase: {
    fontSize: 15,
    fontWeight: '700',
  },
  defaultButton: {
    backgroundColor: '#FF6900',
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  defaultButtonText: {
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
  },
  destructiveButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  destructiveButtonText: {
    color: '#DC2626',
  },
});
