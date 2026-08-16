import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';

export interface AppDateTimePickerProps {
  visible: boolean;
  value: Date;
  mode?: 'date' | 'time' | 'datetime';
  onChange: (date: Date) => void;
  onClose: () => void;
  title?: string;
  themeColor?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function AppDateTimePicker({
  visible,
  value,
  mode = 'date',
  onChange,
  onClose,
  title,
  themeColor = '#FF6900',
  minimumDate,
  maximumDate,
}: AppDateTimePickerProps) {
  const initialDate = value instanceof Date && !isNaN(value.getTime()) ? value : new Date();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(initialDate));
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  
  // Time Picker States
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    let h = initialDate.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [selectedMinute, setSelectedMinute] = useState<number>(initialDate.getMinutes());
  const [isPM, setIsPM] = useState<boolean>(initialDate.getHours() >= 12);
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');

  useEffect(() => {
    if (visible && value) {
      const d = new Date(value);
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      let h = d.getHours() % 12;
      setSelectedHour(h === 0 ? 12 : h);
      setSelectedMinute(d.getMinutes());
      setIsPM(d.getHours() >= 12);
      setActiveTab(mode === 'time' ? 'time' : 'date');
    }
  }, [visible, value, mode]);

  if (!visible) {
    return null;
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    const newDate = new Date(selectedDate);
    newDate.setFullYear(viewYear, viewMonth, day);
    setSelectedDate(newDate);
  };

  const handleQuickPreset = (preset: 'today' | 'yesterday' | 'tomorrow') => {
    const d = new Date();
    if (preset === 'yesterday') {
      d.setDate(d.getDate() - 1);
    } else if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    }
    setSelectedDate(d);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleQuickTimePreset = (h: number, m: number, pm: boolean) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    setIsPM(pm);
  };

  const handleConfirm = () => {
    const finalDate = new Date(selectedDate);
    if (mode === 'time' || mode === 'datetime' || activeTab === 'time') {
      let hours = selectedHour % 12;
      if (isPM) hours += 12;
      finalDate.setHours(hours, selectedMinute, 0, 0);
    }
    onChange(finalDate);
    onClose();
  };

  // Calendar matrix calculation
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayIndex = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInCurrentMonth = getDaysInMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1);
  const firstDayIndex = getFirstDayIndex(viewYear, viewMonth);

  const calendarCells: { day: number; isCurrentMonth: boolean; dateObj: Date }[] = [];

  // Previous month overflow days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dateObj = new Date(viewYear, viewMonth - 1, d);
    calendarCells.push({ day: d, isCurrentMonth: false, dateObj });
  }

  // Current month days
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    const dateObj = new Date(viewYear, viewMonth, i);
    calendarCells.push({ day: i, isCurrentMonth: true, dateObj });
  }

  // Next month overflow days
  const remaining = 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    const dateObj = new Date(viewYear, viewMonth + 1, i);
    calendarCells.push({ day: i, isCurrentMonth: false, dateObj });
  }

  const isSelected = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false;
    const now = new Date();
    return (
      now.getFullYear() === viewYear &&
      now.getMonth() === viewMonth &&
      now.getDate() === day
    );
  };

  const formatHeaderDateDisplay = () => {
    if (mode === 'time') {
      const minStr = selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute;
      return `${selectedHour}:${minStr} ${isPM ? 'PM' : 'AM'}`;
    }
    return selectedDate.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardContainer} onPress={(e) => e.stopPropagation()}>
          {/* Top App Branded Header Banner */}
          <View style={[styles.topHeaderBanner, { backgroundColor: themeColor }]}>
            <View style={styles.headerTopLine}>
              <View style={styles.headerTitleBadge}>
                <MaterialCommunityIcons
                  name={mode === 'time' ? 'clock-outline' : 'calendar-month'}
                  size={14}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.headerSubtitleText}>
                  {title || (mode === 'time' ? 'Select Shift Time' : 'Select Date')}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.headerCloseIcon} activeOpacity={0.7}>
                <FontAwesome name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.headerMainDateDisplay}>{formatHeaderDateDisplay()}</Text>

            {mode === 'datetime' && (
              <View style={styles.tabSwitchContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'date' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('date')}
                >
                  <Text style={[styles.tabText, activeTab === 'date' && styles.tabTextActive]}>Date</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'time' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('time')}
                >
                  <Text style={[styles.tabText, activeTab === 'time' && styles.tabTextActive]}>Time</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Calendar Date Mode Body */}
          {activeTab === 'date' && mode !== 'time' && (
            <View style={styles.calendarBody}>
              {/* Quick Preset Buttons */}
              <View style={styles.quickPresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleQuickPreset('yesterday')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>Yesterday</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetChip, styles.presetChipHighlight]}
                  onPress={() => handleQuickPreset('today')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, { color: themeColor, fontWeight: '700' }]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleQuickPreset('tomorrow')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>Tomorrow</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigation Row */}
              <View style={styles.monthNavigationRow}>
                <TouchableOpacity style={styles.monthNavBtn} onPress={handlePrevMonth} activeOpacity={0.7}>
                  <FontAwesome name="chevron-left" size={13} color="#0A192F" />
                </TouchableOpacity>

                <View style={styles.monthTitleWrapper}>
                  <Text style={styles.monthTitleText}>
                    {MONTH_NAMES[viewMonth]} <Text style={{ color: themeColor }}>{viewYear}</Text>
                  </Text>
                </View>

                <TouchableOpacity style={styles.monthNavBtn} onPress={handleNextMonth} activeOpacity={0.7}>
                  <FontAwesome name="chevron-right" size={13} color="#0A192F" />
                </TouchableOpacity>
              </View>

              {/* Day Name Headers */}
              <View style={styles.weekDaysHeaderRow}>
                {WEEK_DAYS.map((w, idx) => (
                  <View key={idx} style={styles.weekDayCell}>
                    <Text style={[styles.weekDayText, idx === 0 && { color: '#EF4444' }]}>{w}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid Matrix */}
              <View style={styles.daysMatrixGrid}>
                {calendarCells.map((cell, idx) => {
                  const selected = isSelected(cell.day, cell.isCurrentMonth);
                  const today = isToday(cell.day, cell.isCurrentMonth);

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dayCell,
                        selected && [styles.selectedDayCell, { backgroundColor: themeColor }],
                        today && !selected && styles.todayDayCell,
                      ]}
                      onPress={() => handleSelectDay(cell.day, cell.isCurrentMonth)}
                      disabled={!cell.isCurrentMonth}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !cell.isCurrentMonth && styles.overflowDayText,
                          today && !selected && { color: themeColor, fontWeight: '700' },
                          selected && styles.selectedDayText,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {today && !selected && <View style={[styles.todayDot, { backgroundColor: themeColor }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Time Picker Mode Body */}
          {(activeTab === 'time' || mode === 'time') && (
            <View style={styles.timePickerBody}>
              {/* Quick Shift Presets */}
              <Text style={styles.timeSectionLabel}>Common Shift Presets</Text>
              <View style={styles.quickTimePresetRow}>
                <TouchableOpacity
                  style={styles.timePresetPill}
                  onPress={() => handleQuickTimePreset(9, 0, false)}
                >
                  <Text style={styles.timePresetPillText}>09:00 AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePresetPill}
                  onPress={() => handleQuickTimePreset(9, 30, false)}
                >
                  <Text style={styles.timePresetPillText}>09:30 AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePresetPill}
                  onPress={() => handleQuickTimePreset(6, 0, true)}
                >
                  <Text style={styles.timePresetPillText}>06:00 PM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePresetPill}
                  onPress={() => handleQuickTimePreset(6, 30, true)}
                >
                  <Text style={styles.timePresetPillText}>06:30 PM</Text>
                </TouchableOpacity>
              </View>

              {/* Digital Dial Selector */}
              <View style={styles.timeDialCard}>
                {/* Hours Box */}
                <View style={styles.timeUnitBlock}>
                  <TouchableOpacity
                    style={styles.timeStepperBtn}
                    onPress={() => setSelectedHour((h) => (h >= 12 ? 1 : h + 1))}
                  >
                    <FontAwesome name="chevron-up" size={14} color="#6B7280" />
                  </TouchableOpacity>
                  <View style={styles.timeValueDisplay}>
                    <Text style={styles.timeValueNumber}>
                      {selectedHour < 10 ? `0${selectedHour}` : selectedHour}
                    </Text>
                    <Text style={styles.timeUnitSub}>HOUR</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.timeStepperBtn}
                    onPress={() => setSelectedHour((h) => (h <= 1 ? 12 : h - 1))}
                  >
                    <FontAwesome name="chevron-down" size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Colon Separator */}
                <Text style={styles.timeColonSeparator}>:</Text>

                {/* Minutes Box */}
                <View style={styles.timeUnitBlock}>
                  <TouchableOpacity
                    style={styles.timeStepperBtn}
                    onPress={() => setSelectedMinute((m) => (m >= 59 ? 0 : m + 1))}
                  >
                    <FontAwesome name="chevron-up" size={14} color="#6B7280" />
                  </TouchableOpacity>
                  <View style={styles.timeValueDisplay}>
                    <Text style={styles.timeValueNumber}>
                      {selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute}
                    </Text>
                    <Text style={styles.timeUnitSub}>MIN</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.timeStepperBtn}
                    onPress={() => setSelectedMinute((m) => (m <= 0 ? 59 : m - 1))}
                  >
                    <FontAwesome name="chevron-down" size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* AM / PM Switcher */}
                <View style={styles.ampmSelectorContainer}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, !isPM && [styles.ampmBtnActive, { backgroundColor: themeColor }]]}
                    onPress={() => setIsPM(false)}
                  >
                    <Text style={[styles.ampmBtnText, !isPM && styles.ampmBtnTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, isPM && [styles.ampmBtnActive, { backgroundColor: themeColor }]]}
                    onPress={() => setIsPM(true)}
                  >
                    <Text style={[styles.ampmBtnText, isPM && styles.ampmBtnTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons Row */}
          <View style={styles.actionFooterRow}>
            <TouchableOpacity style={styles.cancelActionButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmActionButton, { backgroundColor: themeColor }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <FontAwesome name="check" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmActionText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0A192F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  topHeaderBanner: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerSubtitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCloseIcon: {
    padding: 4,
  },
  headerMainDateDisplay: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tabSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  tabTextActive: {
    color: '#0A192F',
    fontWeight: '700',
  },
  calendarBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  quickPresetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
  },
  presetChipHighlight: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  monthNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrapper: {
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A192F',
  },
  weekDaysHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysMatrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 1,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  overflowDayText: {
    color: '#CBD5E1',
    fontWeight: '400',
  },
  selectedDayCell: {
    borderRadius: 19,
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  todayDayCell: {
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 105, 0, 0.4)',
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  timePickerBody: {
    padding: 18,
  },
  timeSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quickTimePresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  timePresetPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  timePresetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  timeDialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeUnitBlock: {
    alignItems: 'center',
  },
  timeStepperBtn: {
    padding: 6,
    alignItems: 'center',
  },
  timeValueDisplay: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 64,
  },
  timeValueNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0A192F',
  },
  timeUnitSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  timeColonSeparator: {
    fontSize: 26,
    fontWeight: '800',
    color: '#94A3B8',
    marginHorizontal: 10,
    marginBottom: 12,
  },
  ampmSelectorContainer: {
    marginLeft: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  ampmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: 'center',
  },
  ampmBtnActive: {},
  ampmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  ampmBtnTextActive: {
    color: '#FFFFFF',
  },
  actionFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cancelActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#FF6900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
