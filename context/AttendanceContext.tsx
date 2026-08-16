import React, { createContext, useContext, useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

export interface PunchRecord {
  id: string;
  type: 'IN' | 'OUT';
  time: string; // e.g. "08:42:09 am"
  timestamp: number;
}

export interface EmployeeAttendance {
  id: string;
  employeeId: string;
  name: string;
  date: string; // YYYY-MM-DD
  punches: PunchRecord[];
  totalWorkingHours?: string;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY';
}

interface AttendanceContextType {
  multipleTimeEntries: boolean;
  setMultipleTimeEntries: (enabled: boolean) => Promise<void>;
  attendanceRecords: EmployeeAttendance[];
  recordPunch: (employeeId: string, name: string, forcedType?: 'IN' | 'OUT') => { punch: PunchRecord; isNewPunch: boolean; type: 'IN' | 'OUT'; summary: string };
  clearAllRecords: () => Promise<void>;
  getRecordsForDate: (dateStr: string) => EmployeeAttendance[];
}

const STORAGE_FILE = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}visagel_attendance_data.json`;
const SETTINGS_FILE = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}visagel_attendance_settings.json`;

const getTodayDateString = (d: Date = new Date()) => {
  return d.toISOString().split('T')[0];
};

const formatTime12h = (date: Date): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  const secondsStr = seconds < 10 ? '0' + seconds : seconds;
  return `${hours}:${minutesStr}:${secondsStr} ${ampm}`;
};

// Initial mock data with realistic punches
const INITIAL_RECORDS: EmployeeAttendance[] = [
  {
    id: 'att-1',
    employeeId: 'BR-001',
    name: 'Ravi Kiran',
    date: getTodayDateString(),
    punches: [
      { id: 'p-1', type: 'IN', time: '08:42:09 am', timestamp: Date.now() - 1000 * 60 * 180 },
      { id: 'p-2', type: 'OUT', time: '01:15:30 pm', timestamp: Date.now() - 1000 * 60 * 120 },
      { id: 'p-3', type: 'IN', time: '02:00:15 pm', timestamp: Date.now() - 1000 * 60 * 60 },
    ],
    totalWorkingHours: '4 hrs 15 mins',
    status: 'PRESENT',
  },
  {
    id: 'att-2',
    employeeId: 'BR-026',
    name: 'John Doe',
    date: getTodayDateString(),
    punches: [
      { id: 'p-4', type: 'IN', time: '09:05:10 am', timestamp: Date.now() - 1000 * 60 * 240 },
    ],
    status: 'PRESENT',
  },
];

const AttendanceContext = createContext<AttendanceContextType>({
  multipleTimeEntries: true,
  setMultipleTimeEntries: async () => {},
  attendanceRecords: INITIAL_RECORDS,
  recordPunch: () => ({ punch: { id: '', type: 'IN', time: '', timestamp: 0 }, isNewPunch: false, type: 'IN', summary: '' }),
  clearAllRecords: async () => {},
  getRecordsForDate: () => [],
});

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [multipleTimeEntries, setMultipleTimeEntriesState] = useState<boolean>(true);
  const [attendanceRecords, setAttendanceRecords] = useState<EmployeeAttendance[]>(INITIAL_RECORDS);

  useEffect(() => {
    (async () => {
      try {
        if (SETTINGS_FILE) {
          const info = await FileSystem.getInfoAsync(SETTINGS_FILE);
          if (info.exists) {
            const content = await FileSystem.readAsStringAsync(SETTINGS_FILE);
            const data = JSON.parse(content);
            if (typeof data?.multipleTimeEntries === 'boolean') {
              setMultipleTimeEntriesState(data.multipleTimeEntries);
            }
          }
        }

        if (STORAGE_FILE) {
          const info = await FileSystem.getInfoAsync(STORAGE_FILE);
          if (info.exists) {
            const content = await FileSystem.readAsStringAsync(STORAGE_FILE);
            const data = JSON.parse(content);
            if (Array.isArray(data) && data.length > 0) {
              setAttendanceRecords(data);
            }
          }
        }
      } catch (e) {
        console.warn('Failed loading attendance storage', e);
      }
    })();
  }, []);

  const saveSettings = async (enabled: boolean) => {
    setMultipleTimeEntriesState(enabled);
    try {
      if (SETTINGS_FILE) {
        await FileSystem.writeAsStringAsync(
          SETTINGS_FILE,
          JSON.stringify({ multipleTimeEntries: enabled }),
          { encoding: 'utf8' }
        );
      }
    } catch (e) {
      console.warn('Failed saving settings', e);
    }
  };

  const saveRecords = async (records: EmployeeAttendance[]) => {
    setAttendanceRecords(records);
    try {
      if (STORAGE_FILE) {
        await FileSystem.writeAsStringAsync(
          STORAGE_FILE,
          JSON.stringify(records),
          { encoding: 'utf8' }
        );
      }
    } catch (e) {
      console.warn('Failed saving attendance records', e);
    }
  };

  const recordPunch = (
    employeeId: string,
    name: string,
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
    let punchType: 'IN' | 'OUT' = forcedType || 'IN';
    let newPunch: PunchRecord = {
      id: `punch-${timestamp}`,
      type: 'IN',
      time: formattedTime,
      timestamp,
    };

    if (existingIndex >= 0) {
      const existing = updatedRecords[existingIndex];
      const lastPunch = existing.punches[existing.punches.length - 1];

      if (!multipleTimeEntries) {
        // Single Entry mode: If IN already exists and OUT doesn't, mark OUT. If both exist, block or report already completed.
        if (existing.punches.length === 1 && existing.punches[0].type === 'IN') {
          punchType = 'OUT';
        } else if (existing.punches.length >= 2) {
          // Already completed attendance for today
          return {
            punch: lastPunch,
            isNewPunch: false,
            type: lastPunch.type,
            summary: `Attendance already complete (${lastPunch.type} at ${lastPunch.time})`,
          };
        }
      } else {
        // Multi-punch mode: Alternate between IN and OUT
        punchType = forcedType || (lastPunch?.type === 'IN' ? 'OUT' : 'IN');
      }

      newPunch = {
        id: `punch-${timestamp}`,
        type: punchType,
        time: formattedTime,
        timestamp,
      };

      const updatedPunches = [...existing.punches, newPunch];
      updatedRecords[existingIndex] = {
        ...existing,
        punches: updatedPunches,
      };
    } else {
      // First punch for the day
      punchType = forcedType || 'IN';
      newPunch = {
        id: `punch-${timestamp}`,
        type: punchType,
        time: formattedTime,
        timestamp,
      };

      const newRecord: EmployeeAttendance = {
        id: `att-${timestamp}`,
        employeeId,
        name,
        date: today,
        punches: [newPunch],
        status: 'PRESENT',
      };
      updatedRecords = [newRecord, ...updatedRecords];
    }

    saveRecords(updatedRecords);

    const summary = `${punchType === 'IN' ? 'Time In' : 'Time Out'} Recorded (${formattedTime})`;
    return {
      punch: newPunch,
      isNewPunch: true,
      type: punchType,
      summary,
    };
  };

  const clearAllRecords = async () => {
    await saveRecords([]);
  };

  const getRecordsForDate = (dateStr: string) => {
    return attendanceRecords.filter((r) => r.date === dateStr);
  };

  return (
    <AttendanceContext.Provider
      value={{
        multipleTimeEntries,
        setMultipleTimeEntries: saveSettings,
        attendanceRecords,
        recordPunch,
        clearAllRecords,
        getRecordsForDate,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => useContext(AttendanceContext);
