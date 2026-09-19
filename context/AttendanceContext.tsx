import React, { createContext, useContext, useState, useEffect } from 'react';

export {
  CustomField,
  AiModelSettings,
  EnrolledEmployee,
  PunchRecord,
  EmployeeAttendance,
  ShiftEntry,
  LeaveRecord,
  DEFAULT_AI_SETTINGS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_SHIFTS,
} from '@/utils/database';

import {
  CustomField,
  AiModelSettings,
  EnrolledEmployee,
  PunchRecord,
  EmployeeAttendance,
  ShiftEntry,
  LeaveRecord,
  DEFAULT_AI_SETTINGS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_SHIFTS,
  getEmployeesDb,
  saveEmployeeDb,
  deleteEmployeeDb,
  getAttendanceRecordsDb,
  saveAttendanceRecordDb,
  removePunchDb,
  clearAllAttendanceDb,
  getShiftsDb,
  saveShiftsDb,
  getDepartmentsDb,
  saveDepartmentsDb,
  getCustomFieldsDb,
  saveCustomFieldsDb,
  getAiSettingsDb,
  saveAiSettingsDb,
  getLeavesDb,
  saveLeaveDb,
  deleteLeaveDb,
  isEmployeeOnLeaveDb,
  getVoiceFeedbackDb,
  saveVoiceFeedbackDb,
  getGroupScanModeDb,
  saveGroupScanModeDb,
  getKeyValue,
  setKeyValue,
} from '@/utils/database';
import { formatLocalDate } from '@/utils/clockSync';

export interface AttendanceContextType {
  multipleTimeEntries: boolean;
  setMultipleTimeEntries: (enabled: boolean) => Promise<void>;
  attendanceRecords: EmployeeAttendance[];
  enrolledEmployees: EnrolledEmployee[];
  saveEnrolledEmployees: (employees: EnrolledEmployee[]) => Promise<void>;
  addEnrolledEmployee: (emp: Omit<EnrolledEmployee, 'id'>) => Promise<boolean>;
  updateEnrolledEmployee: (id: string, emp: Partial<EnrolledEmployee>) => Promise<boolean>;
  deleteEnrolledEmployee: (id: string) => Promise<boolean>;
  recordPunch: (
    employeeId: string,
    name: string,
    department?: string,
    forcedType?: 'IN' | 'OUT'
  ) => {
    punch: PunchRecord;
    isNewPunch: boolean;
    type: 'IN' | 'OUT';
    summary: string;
    status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';
    isLate?: boolean;
  };
  removePunch: (employeeId: string, date: string, punchId: string) => Promise<void>;
  clearAllRecords: () => Promise<void>;
  getRecordsForDate: (dateStr: string) => EmployeeAttendance[];
  shifts: ShiftEntry[];
  saveShifts: (shifts: ShiftEntry[]) => Promise<void>;
  getActiveShift: () => ShiftEntry | null;
  getPunchTypeFromShift: () => 'IN' | 'OUT';
  departments: string[];
  saveDepartments: (depts: string[]) => Promise<void>;
  customFields: CustomField[];
  saveCustomFields: (fields: CustomField[]) => Promise<void>;
  aiSettings: AiModelSettings;
  saveAiSettings: (settings: Partial<AiModelSettings>) => Promise<void>;
  voiceFeedback: boolean;
  saveVoiceFeedback: (enabled: boolean) => Promise<void>;
  groupScanMode: boolean;
  saveGroupScanMode: (enabled: boolean) => Promise<void>;
  leaves: LeaveRecord[];
  saveLeave: (leave: LeaveRecord) => Promise<void>;
  deleteLeave: (id: string) => Promise<void>;
  markEmployeeLeave: (
    empId: string,
    empName: string,
    start: string,
    end: string,
    type: 'Casual' | 'Sick' | 'Earned' | 'Unpaid',
    reason: string
  ) => Promise<void>;
}

export const DEFAULT_ENROLLED: EnrolledEmployee[] = [
  { id: '1', employeeId: 'BR-001', name: 'Ravi Kiran',    department: 'Engineering', phone: '9876543200', joiningDate: '2026-07-15', photoUri: null },
  { id: '2', employeeId: 'BR-026', name: 'John Doe',      department: 'Engineering', phone: '9876543210', joiningDate: '2026-08-01', photoUri: null },
  { id: '3', employeeId: 'BR-027', name: 'Sarah Connor',  department: 'Design',       phone: '9876543211', joiningDate: '2026-08-10', photoUri: null },
  { id: '4', employeeId: 'BR-028', name: 'Michael Scott', department: 'HR & Admin',  phone: '9876543212', joiningDate: '2026-08-12', photoUri: null },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayDateString = () => formatLocalDate(new Date());

const formatTime12h = (date: Date): string => {
  let h = date.getHours();
  const m = date.getMinutes(), s = date.getSeconds();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
};


/**
 * Compute working hours from a list of punches by pairing IN→OUT.
 * Returns a human-readable string like "4 hrs 33 mins".
 */
export function computeWorkingHours(punches: PunchRecord[]): string | undefined {
  let totalMs = 0;
  let pendingIn: number | null = null;
  for (const p of punches) {
    if (p.type === 'IN') {
      pendingIn = p.timestamp;
    } else if (p.type === 'OUT' && pendingIn !== null) {
      const diff = p.timestamp - pendingIn;
      if (diff > 0) totalMs += diff;
      pendingIn = null;
    }
  }
  if (totalMs <= 0) return undefined;
  const totalMins = Math.round(totalMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins} min${mins !== 1 ? 's' : ''}`;
  if (mins === 0) return `${hrs} hr${hrs !== 1 ? 's' : ''}`;
  return `${hrs} hr${hrs !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
}

/** Returns total minutes from midnight for a time */
export const toMins = (h: number, m: number) => h * 60 + m;

/**
 * Computes difference in minutes between two clock times on a 24-hour circle.
 * Always returns a value between 0 and 720 (12 hours).
 */
export function clockDiffMins(m1: number, m2: number): number {
  let diff = Math.abs(m1 - m2);
  if (diff > 720) diff = 1440 - diff;
  return diff;
}

/**
 * Determine shift-based punch window ('IN' | 'OUT') based on shift start/end timings.
 * Compares current clock distance to shift start vs shift end:
 *  - Closer to shift start → 'IN' Window (morning / shift start arrival period)
 *  - Closer to shift end   → 'OUT' Window (evening / shift departure period)
 */
export function getShiftPunchWindow(shift: ShiftEntry | null, punchDate: Date = new Date()): 'IN' | 'OUT' {
  if (!shift) return 'IN';
  const nowMins = toMins(punchDate.getHours(), punchDate.getMinutes());
  const startMins = toMins(shift.startHour, shift.startMin);
  const endMins = toMins(shift.endHour, shift.endMin);

  const distToStart = clockDiffMins(nowMins, startMins);
  const distToEnd = clockDiffMins(nowMins, endMins);

  return distToStart <= distToEnd ? 'IN' : 'OUT';
}

/**
 * Check if a punch time is past the late cutoff for a shift.
 * Accurately handles both regular shifts and night shifts crossing midnight.
 */
export function isLateForShift(shift: ShiftEntry | null, punchDate: Date = new Date()): boolean {
  if (!shift) return false;
  const punchMins = toMins(punchDate.getHours(), punchDate.getMinutes());
  const startMins = toMins(shift.startHour, shift.startMin);
  const cutoffMins = toMins(shift.lateCutoffHour, shift.lateCutoffMin);

  // Grace duration after shift start (handles midnight crossing)
  let graceMins = cutoffMins - startMins;
  if (graceMins < 0) graceMins += 1440;

  // Signed elapsed minutes from shift start on a 24-hour circle
  // Negative = arrived early before start; Positive = arrived after start
  let elapsedMins = punchMins - startMins;
  if (elapsedMins < -720) elapsedMins += 1440;
  if (elapsedMins > 720) elapsedMins -= 1440;

  return elapsedMins > graceMins;
}

/**
 * Determine punch type (IN/OUT) based on active shift timing and employee punch state.
 */
export function resolvePunchType(
  shift: ShiftEntry | null,
  lastPunchType: 'IN' | 'OUT' | null,
  multipleEntries: boolean,
  punchDate: Date = new Date()
): 'IN' | 'OUT' {
  const windowType = getShiftPunchWindow(shift, punchDate);

  // If this is the employee's first punch today: governed strictly by shift timing!
  if (!lastPunchType) {
    return windowType;
  }

  // If multiple entries are allowed or single entry: alternate between IN and OUT
  return lastPunchType === 'IN' ? 'OUT' : 'IN';
}

// ── Initial mock data ─────────────────────────────────────────────────────────

const INITIAL_RECORDS: EmployeeAttendance[] = [
  {
    id: 'att-1', employeeId: 'BR-001', name: 'Ravi Kiran', date: getTodayDateString(),
    punches: [
      { id: 'p-1', type: 'IN',  time: '08:42:09 am', timestamp: Date.now() - 1000 * 60 * 180 },
      { id: 'p-2', type: 'OUT', time: '01:15:30 pm', timestamp: Date.now() - 1000 * 60 * 120 },
    ],
    totalWorkingHours: '4 hrs 33 mins', status: 'PRESENT',
  },
  {
    id: 'att-2', employeeId: 'BR-026', name: 'John Doe', date: getTodayDateString(),
    punches: [{ id: 'p-4', type: 'IN', time: '09:05:10 am', timestamp: Date.now() - 1000 * 60 * 240 }],
    status: 'PRESENT',
  },
];

// ── Context ───────────────────────────────────────────────────────────────────

const AttendanceContext = createContext<AttendanceContextType>({
  multipleTimeEntries: true,
  setMultipleTimeEntries: async () => {},
  attendanceRecords: INITIAL_RECORDS,
  enrolledEmployees: DEFAULT_ENROLLED,
  saveEnrolledEmployees: async () => {},
  addEnrolledEmployee: async () => false,
  updateEnrolledEmployee: async () => false,
  deleteEnrolledEmployee: async () => false,
  recordPunch: () => ({ punch: { id: '', type: 'IN', time: '', timestamp: 0 }, isNewPunch: false, type: 'IN', summary: '', status: 'PRESENT' }),
  removePunch: async () => {},
  clearAllRecords: async () => {},
  getRecordsForDate: () => [],
  shifts: DEFAULT_SHIFTS,
  saveShifts: async () => {},
  getActiveShift: () => DEFAULT_SHIFTS[0],
  getPunchTypeFromShift: () => 'IN',
  departments: DEFAULT_DEPARTMENTS,
  saveDepartments: async () => {},
  customFields: [],
  saveCustomFields: async () => {},
  aiSettings: DEFAULT_AI_SETTINGS,
  saveAiSettings: async () => {},
  voiceFeedback: true,
  saveVoiceFeedback: async () => {},
  groupScanMode: false,
  saveGroupScanMode: async () => {},
  leaves: [],
  saveLeave: async () => {},
  deleteLeave: async () => {},
  markEmployeeLeave: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [multipleTimeEntries, setMultipleTimeEntriesState] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<EmployeeAttendance[]>([]);
  const [enrolledEmployees, setEnrolledEmployees] = useState<EnrolledEmployee[]>([]);
  const [shifts, setShiftsState] = useState<ShiftEntry[]>(DEFAULT_SHIFTS);
  const [departments, setDepartmentsState] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [customFields, setCustomFieldsState] = useState<CustomField[]>([]);
  const [aiSettings, setAiSettingsState] = useState<AiModelSettings>(DEFAULT_AI_SETTINGS);
  const [leaves, setLeavesState] = useState<LeaveRecord[]>([]);
  const [voiceFeedback, setVoiceFeedbackState] = useState(true);
  const [groupScanMode, setGroupScanModeState] = useState(false);

  // Load SQLite database on mount
  useEffect(() => {
    try {
      const multVal = getKeyValue('multiple_time_entries');
      if (multVal !== null) {
        setMultipleTimeEntriesState(multVal === 'true');
      }

      setEnrolledEmployees(getEmployeesDb());
      setAttendanceRecords(getAttendanceRecordsDb());
      setShiftsState(getShiftsDb());
      setDepartmentsState(getDepartmentsDb());
      setCustomFieldsState(getCustomFieldsDb());
      setAiSettingsState(getAiSettingsDb());
      setLeavesState(getLeavesDb());
      setVoiceFeedbackState(getVoiceFeedbackDb());
      setGroupScanModeState(getGroupScanModeDb());
    } catch (e) {
      console.warn('[AttendanceContext] SQLite load error', e);
    }
  }, []);

  const saveSettings = async (enabled: boolean) => {
    setMultipleTimeEntriesState(enabled);
    setKeyValue('multiple_time_entries', enabled ? 'true' : 'false');
  };

  const saveAiSettings = async (updates: Partial<AiModelSettings>) => {
    const updated = { ...aiSettings, ...updates };
    setAiSettingsState(updated);
    saveAiSettingsDb(updates);
  };

  const saveVoiceFeedback = async (enabled: boolean) => {
    setVoiceFeedbackState(enabled);
    saveVoiceFeedbackDb(enabled);
  };

  const saveGroupScanMode = async (enabled: boolean) => {
    setGroupScanModeState(enabled);
    saveGroupScanModeDb(enabled);
  };

  const saveLeave = async (leave: LeaveRecord) => {
    saveLeaveDb(leave);
    setLeavesState(getLeavesDb());
  };

  const deleteLeave = async (id: string) => {
    deleteLeaveDb(id);
    setLeavesState(getLeavesDb());
  };

  const markEmployeeLeave = async (
    empId: string,
    empName: string,
    start: string,
    end: string,
    type: 'Casual' | 'Sick' | 'Earned' | 'Unpaid',
    reason: string
  ) => {
    const leave: LeaveRecord = {
      id: `leave-${Date.now()}`,
      employeeId: empId,
      employeeName: empName,
      startDate: start,
      endDate: end,
      type,
      reason,
      status: 'APPROVED',
      createdAt: Date.now(),
    };
    saveLeaveDb(leave);
    setLeavesState(getLeavesDb());
  };

  const saveRecords = async (records: EmployeeAttendance[]) => {
    setAttendanceRecords(records);
    for (const rec of records) {
      saveAttendanceRecordDb(rec);
    }
  };

  const saveEnrolledEmployees = async (employees: EnrolledEmployee[]) => {
    setEnrolledEmployees(employees);
    for (const emp of employees) {
      saveEmployeeDb(emp);
    }
  };

  const saveShifts = async (newShifts: ShiftEntry[]) => {
    setShiftsState(newShifts);
    saveShiftsDb(newShifts);
  };

  const saveDepartments = async (depts: string[]) => {
    setDepartmentsState(depts);
    saveDepartmentsDb(depts);
  };

  const saveCustomFields = async (fields: CustomField[]) => {
    setCustomFieldsState(fields);
    saveCustomFieldsDb(fields);
  };

  const addEnrolledEmployee = async (emp: Omit<EnrolledEmployee, 'id'>): Promise<boolean> => {
    const newEmp: EnrolledEmployee = { ...emp, id: Date.now().toString() };
    saveEmployeeDb(newEmp);
    setEnrolledEmployees((prev) => [newEmp, ...prev]);
    return true;
  };

  const updateEnrolledEmployee = async (id: string, updates: Partial<EnrolledEmployee>): Promise<boolean> => {
    const updatedList = enrolledEmployees.map((e) => (e.id === id ? { ...e, ...updates } : e));
    setEnrolledEmployees(updatedList);
    const target = updatedList.find((e) => e.id === id);
    if (target) saveEmployeeDb(target);
    return true;
  };

  const deleteEnrolledEmployee = async (id: string): Promise<boolean> => {
    deleteEmployeeDb(id);
    setEnrolledEmployees((prev) => prev.filter((e) => e.id !== id));
    return true;
  };

  const getActiveShift = (): ShiftEntry | null => {
    const explicit = shifts.find((s) => s.isActive);
    if (explicit) return explicit;
    if (shifts.length === 0) return null;

    // Auto-detect shift closest to current time
    const now = new Date();
    const nowMins = toMins(now.getHours(), now.getMinutes());
    let bestShift = shifts[0];
    let minDiff = 9999;
    for (const s of shifts) {
      const diff = clockDiffMins(nowMins, toMins(s.startHour, s.startMin));
      if (diff < minDiff) {
        minDiff = diff;
        bestShift = s;
      }
    }
    return bestShift;
  };

  const getPunchTypeFromShift = (): 'IN' | 'OUT' => {
    const active = getActiveShift();
    return getShiftPunchWindow(active, new Date());
  };

  const recordPunch = (
    employeeId: string,
    name: string,
    department?: string,
    forcedType?: 'IN' | 'OUT'
  ): {
    punch: PunchRecord;
    isNewPunch: boolean;
    type: 'IN' | 'OUT';
    summary: string;
    status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';
    isLate?: boolean;
  } => {
    const today = getTodayDateString();
    const now = new Date();
    const formattedTime = formatTime12h(now);
    const timestamp = now.getTime();

    const existingIndex = attendanceRecords.findIndex(
      (r) => r.employeeId === employeeId && r.date === today
    );

    let updatedRecords = [...attendanceRecords];
    const activeShift = getActiveShift();
    const windowType = getShiftPunchWindow(activeShift, now);

    if (existingIndex >= 0) {
      const existing = updatedRecords[existingIndex];
      const lastPunch = existing.punches[existing.punches.length - 1];

      // Anti-duplicate protection: If an employee tries to punch again within 60 seconds of their last punch
      if (timestamp - lastPunch.timestamp < 60000) {
        return {
          punch: lastPunch,
          isNewPunch: false,
          type: lastPunch.type,
          summary: `Already clocked ${lastPunch.type === 'IN' ? 'IN' : 'OUT'} (${lastPunch.time})`,
          status: existing.status,
          isLate: existing.status === 'LATE',
        };
      }

      let punchType: 'IN' | 'OUT';
      if (!multipleTimeEntries) {
        if (existing.punches.length === 1 && existing.punches[0].type === 'IN') {
          punchType = 'OUT';
        } else if (existing.punches.length >= 2) {
          return {
            punch: lastPunch,
            isNewPunch: false,
            type: lastPunch.type,
            summary: `Shift completed (${lastPunch.type} at ${lastPunch.time})`,
            status: existing.status,
            isLate: existing.status === 'LATE',
          };
        } else {
          punchType = forcedType ?? (lastPunch.type === 'IN' ? 'OUT' : 'IN');
        }
      } else {
        // Multi-punch: alternate between IN and OUT
        punchType = forcedType ?? (lastPunch?.type === 'IN' ? 'OUT' : 'IN');
      }

      const newPunch: PunchRecord = { id: `punch-${timestamp}`, type: punchType, time: formattedTime, timestamp };
      const updatedPunches = [...existing.punches, newPunch];
      const workingHours = computeWorkingHours(updatedPunches);

      // Determine attendance status
      let recordStatus: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' = existing.status;

      // If this is the first IN punch for today, check if late
      if (punchType === 'IN' && !existing.punches.some((p) => p.type === 'IN')) {
        const late = isLateForShift(activeShift, now);
        recordStatus = late ? 'LATE' : 'PRESENT';
      }

      // If punching OUT, evaluate total working time for half-day status
      if (punchType === 'OUT') {
        let totalMs = 0;
        let pendingIn: number | null = null;
        for (const p of updatedPunches) {
          if (p.type === 'IN') pendingIn = p.timestamp;
          else if (p.type === 'OUT' && pendingIn !== null) {
            totalMs += p.timestamp - pendingIn;
            pendingIn = null;
          }
        }
        // Less than 4 hours worked = HALF_DAY
        if (totalMs > 0 && totalMs < 4 * 3600 * 1000) {
          recordStatus = 'HALF_DAY';
        }
      }

      updatedRecords[existingIndex] = {
        ...existing,
        punches: updatedPunches,
        totalWorkingHours: workingHours,
        status: recordStatus,
      };
      saveRecords(updatedRecords);

      const isLate = recordStatus === 'LATE';
      const summary =
        punchType === 'IN'
          ? isLate
            ? `Time In · Late (${formattedTime})`
            : `Time In (${formattedTime})`
          : `Time Out (${formattedTime})${workingHours ? ` · ${workingHours}` : ''}`;

      return {
        punch: newPunch,
        isNewPunch: true,
        type: punchType,
        summary,
        status: recordStatus,
        isLate,
      };
    } else {
      // First punch of the day: governed strictly by shift timing!
      const punchType: 'IN' | 'OUT' = forcedType ?? windowType;
      const isLate = punchType === 'IN' ? isLateForShift(activeShift, now) : false;
      const recordStatus: 'PRESENT' | 'LATE' | 'HALF_DAY' =
        punchType === 'OUT' ? 'HALF_DAY' : isLate ? 'LATE' : 'PRESENT';

      const newPunch: PunchRecord = { id: `punch-${timestamp}`, type: punchType, time: formattedTime, timestamp };
      const newRecord: EmployeeAttendance = {
        id: `att-${timestamp}`,
        employeeId,
        name,
        department,
        date: today,
        punches: [newPunch],
        totalWorkingHours: undefined,
        status: recordStatus,
      };

      updatedRecords = [newRecord, ...updatedRecords];
      saveRecords(updatedRecords);

      const summary =
        punchType === 'IN'
          ? isLate
            ? `Time In · Late (${formattedTime})`
            : `Time In (${formattedTime})`
          : `Time Out (${formattedTime})`;

      return {
        punch: newPunch,
        isNewPunch: true,
        type: punchType,
        summary,
        status: recordStatus,
        isLate,
      };
    }
  };

  const removePunch = async (employeeId: string, date: string, punchId: string): Promise<void> => {
    removePunchDb(employeeId, date, punchId);
    setAttendanceRecords(getAttendanceRecordsDb());
  };

  const clearAllRecords = async () => {
    clearAllAttendanceDb();
    setAttendanceRecords([]);
  };

  const getRecordsForDate = (dateStr: string) =>
    attendanceRecords.filter((r) => r.date === dateStr);

  return (
    <AttendanceContext.Provider
      value={{
        multipleTimeEntries,
        setMultipleTimeEntries: saveSettings,
        attendanceRecords,
        enrolledEmployees,
        saveEnrolledEmployees,
        addEnrolledEmployee,
        updateEnrolledEmployee,
        deleteEnrolledEmployee,
        recordPunch,
        removePunch,
        clearAllRecords,
        getRecordsForDate,
        shifts,
        saveShifts,
        getActiveShift,
        getPunchTypeFromShift,
        departments,
        saveDepartments,
        customFields,
        saveCustomFields,
        aiSettings,
        saveAiSettings,
        voiceFeedback,
        saveVoiceFeedback,
        groupScanMode,
        saveGroupScanMode,
        leaves,
        saveLeave,
        deleteLeave,
        markEmployeeLeave,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => useContext(AttendanceContext);
