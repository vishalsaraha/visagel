import React, { createContext, useContext, useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomField {
  id: string;
  label: string;
  key: string;
  inputType: 'text' | 'phone' | 'number' | 'email';
  isRequired: boolean;
}

export interface EnrolledEmployee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  phone: string;
  joiningDate: string;
  photoUri: string | null;
  customData?: Record<string, string>;
}

export interface PunchRecord {
  id: string;
  type: 'IN' | 'OUT';
  time: string;
  timestamp: number;
}

export interface EmployeeAttendance {
  id: string;
  employeeId: string;
  name: string;
  department?: string;
  date: string;
  punches: PunchRecord[];
  totalWorkingHours?: string;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY';
}

export interface ShiftEntry {
  id: string;
  name: string;
  /** Hours (0-23) */
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  /** After this time employees are counted as late */
  lateCutoffHour: number;
  lateCutoffMin: number;
  isActive: boolean;
}

interface AttendanceContextType {
  multipleTimeEntries: boolean;
  setMultipleTimeEntries: (enabled: boolean) => Promise<void>;
  attendanceRecords: EmployeeAttendance[];
  enrolledEmployees: EnrolledEmployee[];
  saveEnrolledEmployees: (employees: EnrolledEmployee[]) => Promise<void>;
  addEnrolledEmployee: (emp: Omit<EnrolledEmployee, 'id'>) => Promise<boolean>;
  updateEnrolledEmployee: (id: string, emp: Partial<EnrolledEmployee>) => Promise<boolean>;
  deleteEnrolledEmployee: (id: string) => Promise<boolean>;
  recordPunch: (employeeId: string, name: string, department?: string, forcedType?: 'IN' | 'OUT') => { punch: PunchRecord; isNewPunch: boolean; type: 'IN' | 'OUT'; summary: string };
  removePunch: (employeeId: string, date: string, punchId: string) => Promise<void>;
  clearAllRecords: () => Promise<void>;
  getRecordsForDate: (dateStr: string) => EmployeeAttendance[];
  shifts: ShiftEntry[];
  saveShifts: (shifts: ShiftEntry[]) => Promise<void>;
  getActiveShift: () => ShiftEntry | null;
  /** Determine whether current time is IN or OUT based on active shift */
  getPunchTypeFromShift: () => 'IN' | 'OUT';
  // ── Dynamic Departments ─────────────────────────────────────────────────
  departments: string[];
  saveDepartments: (depts: string[]) => Promise<void>;
  // ── Custom Enrolment Fields ──────────────────────────────────────────────
  customFields: CustomField[];
  saveCustomFields: (fields: CustomField[]) => Promise<void>;
}

// ── Storage paths ─────────────────────────────────────────────────────────────

const base = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
const STORAGE_FILE   = `${base}visagel_attendance_data.json`;
const SETTINGS_FILE  = `${base}visagel_attendance_settings.json`;
const EMPLOYEES_FILE = `${base}visagel_enrolled_employees.json`;
const SHIFTS_FILE    = `${base}visagel_shifts.json`;
const DEPTS_FILE     = `${base}visagel_departments.json`;
const FIELDS_FILE    = `${base}visagel_custom_fields.json`;

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_DEPARTMENTS: string[] = [
  'Engineering', 'HR & Admin', 'Design', 'Marketing', 'Finance', 'Operations',
];

const DEFAULT_ENROLLED: EnrolledEmployee[] = [
  { id: '1', employeeId: 'BR-001', name: 'Ravi Kiran',    department: 'Engineering', phone: '9876543200', joiningDate: '2026-07-15', photoUri: null },
  { id: '2', employeeId: 'BR-026', name: 'John Doe',      department: 'Engineering', phone: '9876543210', joiningDate: '2026-08-01', photoUri: null },
  { id: '3', employeeId: 'BR-027', name: 'Sarah Connor',  department: 'Design',       phone: '9876543211', joiningDate: '2026-08-10', photoUri: null },
  { id: '4', employeeId: 'BR-028', name: 'Michael Scott', department: 'HR & Admin',  phone: '9876543212', joiningDate: '2026-08-12', photoUri: null },
];

export const DEFAULT_SHIFTS: ShiftEntry[] = [
  { id: '1', name: 'Day Shift',   startHour: 9,  startMin: 0, endHour: 18, endMin: 0, lateCutoffHour: 9,  lateCutoffMin: 30, isActive: true  },
  { id: '2', name: 'Night Shift', startHour: 21, startMin: 0, endHour: 6,  endMin: 0, lateCutoffHour: 21, lateCutoffMin: 30, isActive: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const formatTime12h = (date: Date): string => {
  let h = date.getHours();
  const m = date.getMinutes(), s = date.getSeconds();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
};

/** Returns total minutes from midnight for a shift boundary */
const toMins = (h: number, m: number) => h * 60 + m;

/**
 * Determine punch type (IN/OUT) based on active shift timing.
 *
 * Logic:
 *  - Find the midpoint of the shift (average of start & end, accounting for midnight crossing).
 *  - If current time is in the first half of the shift → IN
 *  - If in the second half → OUT
 *  - No active shift → default to IN for first punch, OUT for second.
 */
function resolvePunchType(shift: ShiftEntry | null, lastPunchType: 'IN' | 'OUT' | null, multipleEntries: boolean): 'IN' | 'OUT' {
  if (!shift) {
    // No shift: alternate IN/OUT
    return lastPunchType === 'IN' ? 'OUT' : 'IN';
  }

  const now = new Date();
  const nowMins = toMins(now.getHours(), now.getMinutes());
  const startMins = toMins(shift.startHour, shift.startMin);
  let endMins = toMins(shift.endHour, shift.endMin);

  // Handle midnight crossing for night shifts
  if (endMins <= startMins) endMins += 24 * 60;

  // Normalise nowMins relative to shift start
  let relNow = nowMins < startMins ? nowMins + 24 * 60 : nowMins;

  const shiftDuration = endMins - startMins;
  const halfShift = shiftDuration / 2;
  const relElapsed = relNow - startMins;

  // IN if in first half of shift, OUT if in second half
  if (relElapsed < halfShift) return 'IN';
  return 'OUT';
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
  recordPunch: () => ({ punch: { id: '', type: 'IN', time: '', timestamp: 0 }, isNewPunch: false, type: 'IN', summary: '' }),
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
});

// ── Provider ──────────────────────────────────────────────────────────────────

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [multipleTimeEntries, setMultipleTimeEntriesState] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<EmployeeAttendance[]>(INITIAL_RECORDS);
  const [enrolledEmployees, setEnrolledEmployees] = useState<EnrolledEmployee[]>(DEFAULT_ENROLLED);
  const [shifts, setShiftsState] = useState<ShiftEntry[]>(DEFAULT_SHIFTS);
  const [departments, setDepartmentsState] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [customFields, setCustomFieldsState] = useState<CustomField[]>([]);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      try {
        const loadJson = async (path: string) => {
          const info = await FileSystem.getInfoAsync(path);
          if (!info.exists) return null;
          return JSON.parse(await FileSystem.readAsStringAsync(path));
        };

        const settings = await loadJson(SETTINGS_FILE);
        if (typeof settings?.multipleTimeEntries === 'boolean') {
          setMultipleTimeEntriesState(settings.multipleTimeEntries);
        }

        const records = await loadJson(STORAGE_FILE);
        if (Array.isArray(records) && records.length > 0) setAttendanceRecords(records);

        const emps = await loadJson(EMPLOYEES_FILE);
        if (Array.isArray(emps) && emps.length > 0) setEnrolledEmployees(emps);

        const savedShifts = await loadJson(SHIFTS_FILE);
        if (Array.isArray(savedShifts) && savedShifts.length > 0) setShiftsState(savedShifts);

        const savedDepts = await loadJson(DEPTS_FILE);
        if (Array.isArray(savedDepts) && savedDepts.length > 0) setDepartmentsState(savedDepts);

        const savedFields = await loadJson(FIELDS_FILE);
        if (Array.isArray(savedFields)) setCustomFieldsState(savedFields);
      } catch (e) {
        console.warn('[AttendanceContext] Load error', e);
      }
    })();
  }, []);

  const writeJson = async (path: string, data: unknown) => {
    try {
      await FileSystem.writeAsStringAsync(path, JSON.stringify(data), { encoding: 'utf8' });
    } catch (e) {
      console.warn('[AttendanceContext] Write error', e);
    }
  };

  const saveSettings = async (enabled: boolean) => {
    setMultipleTimeEntriesState(enabled);
    await writeJson(SETTINGS_FILE, { multipleTimeEntries: enabled });
  };

  const saveRecords = async (records: EmployeeAttendance[]) => {
    setAttendanceRecords(records);
    await writeJson(STORAGE_FILE, records);
  };

  const saveEnrolledEmployees = async (employees: EnrolledEmployee[]) => {
    setEnrolledEmployees(employees);
    await writeJson(EMPLOYEES_FILE, employees);
  };

  const saveShifts = async (newShifts: ShiftEntry[]) => {
    setShiftsState(newShifts);
    await writeJson(SHIFTS_FILE, newShifts);
  };

  const saveDepartments = async (depts: string[]) => {
    setDepartmentsState(depts);
    await writeJson(DEPTS_FILE, depts);
  };

  const saveCustomFields = async (fields: CustomField[]) => {
    setCustomFieldsState(fields);
    await writeJson(FIELDS_FILE, fields);
  };

  const addEnrolledEmployee = async (emp: Omit<EnrolledEmployee, 'id'>): Promise<boolean> => {
    const newEmp: EnrolledEmployee = { ...emp, id: Date.now().toString() };
    await saveEnrolledEmployees([newEmp, ...enrolledEmployees]);
    return true;
  };

  const updateEnrolledEmployee = async (id: string, updates: Partial<EnrolledEmployee>): Promise<boolean> => {
    await saveEnrolledEmployees(enrolledEmployees.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    return true;
  };

  const deleteEnrolledEmployee = async (id: string): Promise<boolean> => {
    await saveEnrolledEmployees(enrolledEmployees.filter((e) => e.id !== id));
    return true;
  };

  const getActiveShift = (): ShiftEntry | null =>
    shifts.find((s) => s.isActive) ?? null;

  const getPunchTypeFromShift = (): 'IN' | 'OUT' => {
    const active = getActiveShift();
    return resolvePunchType(active, null, multipleTimeEntries);
  };

  const recordPunch = (
    employeeId: string,
    name: string,
    department?: string,
    forcedType?: 'IN' | 'OUT'
  ): { punch: PunchRecord; isNewPunch: boolean; type: 'IN' | 'OUT'; summary: string } => {
    const today = getTodayDateString();
    const now = new Date();
    const formattedTime = formatTime12h(now);
    const timestamp = now.getTime();

    const existingIndex = attendanceRecords.findIndex(
      (r) => r.employeeId === employeeId && r.date === today
    );

    let updatedRecords = [...attendanceRecords];
    let punchType: 'IN' | 'OUT';
    const activeShift = getActiveShift();

    if (existingIndex >= 0) {
      const existing = updatedRecords[existingIndex];
      const lastPunch = existing.punches[existing.punches.length - 1];

      if (!multipleTimeEntries) {
        if (existing.punches.length === 1 && existing.punches[0].type === 'IN') {
          punchType = 'OUT';
        } else if (existing.punches.length >= 2) {
          return {
            punch: lastPunch,
            isNewPunch: false,
            type: lastPunch.type,
            summary: `Already complete (${lastPunch.type} at ${lastPunch.time})`,
          };
        } else {
          punchType = 'IN';
        }
      } else {
        // Multi-punch: use shift timing to determine IN/OUT
        if (forcedType) {
          punchType = forcedType;
        } else {
          punchType = resolvePunchType(activeShift, lastPunch?.type ?? null, true);
        }
      }

      const newPunch: PunchRecord = { id: `punch-${timestamp}`, type: punchType, time: formattedTime, timestamp };
      updatedRecords[existingIndex] = { ...existing, punches: [...existing.punches, newPunch] };

      saveRecords(updatedRecords);
      return { punch: newPunch, isNewPunch: true, type: punchType, summary: `${punchType === 'IN' ? 'Time In' : 'Time Out'} (${formattedTime})` };
    } else {
      // First punch today — always IN (or forced)
      punchType = forcedType ?? 'IN';
      const newPunch: PunchRecord = { id: `punch-${timestamp}`, type: punchType, time: formattedTime, timestamp };
      const newRecord: EmployeeAttendance = {
        id: `att-${timestamp}`, employeeId, name, department, date: today,
        punches: [newPunch], status: 'PRESENT',
      };
      updatedRecords = [newRecord, ...updatedRecords];
      saveRecords(updatedRecords);
      return { punch: newPunch, isNewPunch: true, type: punchType, summary: `Time In (${formattedTime})` };
    }
  };

  const removePunch = async (employeeId: string, date: string, punchId: string): Promise<void> => {
    const updated = attendanceRecords.map((r) => {
      if (r.employeeId !== employeeId || r.date !== date) return r;
      return { ...r, punches: r.punches.filter((p) => p.id !== punchId) };
    }).filter((r) => r.punches.length > 0); // remove the record entirely if no punches left
    await saveRecords(updated);
  };

  const clearAllRecords = async () => saveRecords([]);

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
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => useContext(AttendanceContext);
