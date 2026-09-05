import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

export interface CustomField {
  id: string;
  label: string;
  key: string;
  inputType: 'text' | 'phone' | 'number' | 'email';
  isRequired: boolean;
}

export interface AiModelSettings {
  modelEngine: 'local' | 'cloud';
  livenessMode: 'strict' | 'balanced' | 'off';
  minConfidence: number;
  scanCooldownSec: number;
  cloudApiUrl: string;
  cloudApiKey: string;
  cloudApiSecret: string;
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
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  lateCutoffHour: number;
  lateCutoffMin: number;
  isActive: boolean;
}

export const DEFAULT_AI_SETTINGS: AiModelSettings = {
  modelEngine: 'local',
  livenessMode: 'balanced',
  minConfidence: 75,
  scanCooldownSec: 30,
  cloudApiUrl: 'https://api-us.faceplusplus.com/facepp/v3/compare',
  cloudApiKey: '',
  cloudApiSecret: '',
};

export const DEFAULT_DEPARTMENTS: string[] = [
  'Engineering', 'HR & Admin', 'Design', 'Marketing', 'Finance', 'Operations',
];

export const DEFAULT_SHIFTS: ShiftEntry[] = [
  { id: '1', name: 'Day Shift', startHour: 9, startMin: 0, endHour: 18, endMin: 0, lateCutoffHour: 9, lateCutoffMin: 30, isActive: true },
  { id: '2', name: 'Night Shift', startHour: 21, startMin: 0, endHour: 6, endMin: 0, lateCutoffHour: 21, lateCutoffMin: 30, isActive: false },
];

const DB_NAME = 'visagel.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let isSqliteAvailable = true;

function getDb(): SQLite.SQLiteDatabase | null {
  if (!isSqliteAvailable) return null;
  if (!dbInstance && !isInitializing) {
    isInitializing = true;
    try {
      dbInstance = SQLite.openDatabaseSync(DB_NAME);
      initSchema(dbInstance);
    } catch (err) {
      console.warn('[SQLite] SQLite database not supported in this environment, using fallback:', err);
      isSqliteAvailable = false;
      dbInstance = null;
    } finally {
      isInitializing = false;
    }
  }
  return dbInstance;
}

function initSchema(db: SQLite.SQLiteDatabase) {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS key_values (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      phone TEXT,
      joining_date TEXT,
      photo_uri TEXT,
      custom_data TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      total_working_hours TEXT,
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS punches (
      id TEXT PRIMARY KEY,
      attendance_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      time TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY(attendance_id) REFERENCES attendance_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      start_min INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      end_min INTEGER NOT NULL,
      late_cutoff_hour INTEGER NOT NULL,
      late_cutoff_min INTEGER NOT NULL,
      is_active INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      key_name TEXT NOT NULL,
      input_type TEXT NOT NULL,
      is_required INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_punches_attendance ON punches(attendance_id);
    CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON employees(employee_id);
  `);

  migrateLegacyData(db);
}

// ── Legacy JSON File Migration ────────────────────────────────────────────────
function migrateLegacyData(db: SQLite.SQLiteDatabase) {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM key_values WHERE key = ?', ['migrated_json']);
  if (row?.value === 'true') return;

  try {
    const base = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';

    // Migrate Employees
    const empFile = `${base}visagel_enrolled_employees.json`;
    const empInfo = FileSystem.getInfoAsync(empFile);
    empInfo.then((info) => {
      if (info.exists) {
        FileSystem.readAsStringAsync(empFile).then((str) => {
          try {
            const list: EnrolledEmployee[] = JSON.parse(str);
            if (Array.isArray(list)) {
              for (const emp of list) {
                saveEmployeeDb(emp);
              }
            }
          } catch (_) {}
        });
      }
    });

    // Migrate Shifts
    const shiftFile = `${base}visagel_shifts.json`;
    FileSystem.getInfoAsync(shiftFile).then((info) => {
      if (info.exists) {
        FileSystem.readAsStringAsync(shiftFile).then((str) => {
          try {
            const list: ShiftEntry[] = JSON.parse(str);
            if (Array.isArray(list) && list.length > 0) {
              saveShiftsDb(list);
            }
          } catch (_) {}
        });
      }
    });

    // Migrate AI Settings
    const aiFile = `${base}visagel_ai_settings.json`;
    FileSystem.getInfoAsync(aiFile).then((info) => {
      if (info.exists) {
        FileSystem.readAsStringAsync(aiFile).then((str) => {
          try {
            const obj = JSON.parse(str);
            if (obj && typeof obj === 'object') {
              saveAiSettingsDb(obj);
            }
          } catch (_) {}
        });
      }
    });

    // Mark as migrated
    db.runSync('INSERT OR REPLACE INTO key_values (key, value) VALUES (?, ?)', ['migrated_json', 'true']);
  } catch (err) {
    console.warn('[SQLite] Migration warning:', err);
  }
}

// ── Key Value Store (Settings & Password) ─────────────────────────────────────

export function getKeyValue(key: string): string | null {
  const db = getDb();
  if (!db) return null;
  try {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM key_values WHERE key = ?', [key]);
    return row ? row.value : null;
  } catch {
    return null;
  }
}

export function setKeyValue(key: string, value: string): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('INSERT OR REPLACE INTO key_values (key, value) VALUES (?, ?)', [key, value]);
  } catch {}
}

// ── Enrolled Employees ────────────────────────────────────────────────────────

export function getEmployeesDb(): EnrolledEmployee[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.getAllSync<any>('SELECT * FROM employees ORDER BY name ASC');
    return rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.name,
      department: r.department,
      phone: r.phone || '',
      joiningDate: r.joining_date || '',
      photoUri: r.photo_uri || null,
      customData: r.custom_data ? JSON.parse(r.custom_data) : undefined,
    }));
  } catch {
    return [];
  }
}

export function saveEmployeeDb(emp: EnrolledEmployee): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync(
      `INSERT OR REPLACE INTO employees (id, employee_id, name, department, phone, joining_date, photo_uri, custom_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emp.id,
        emp.employeeId,
        emp.name,
        emp.department,
        emp.phone || '',
        emp.joiningDate || '',
        emp.photoUri || null,
        emp.customData ? JSON.stringify(emp.customData) : null,
      ]
    );
  } catch {}
}

export function deleteEmployeeDb(id: string): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('DELETE FROM employees WHERE id = ?', [id]);
  } catch {}
}

// ── Attendance & Punches ──────────────────────────────────────────────────────

export function getAttendanceRecordsDb(): EmployeeAttendance[] {
  const db = getDb();
  if (!db) return [];
  try {
    const attRows = db.getAllSync<any>('SELECT * FROM attendance_records ORDER BY date DESC');
    const punchRows = db.getAllSync<any>('SELECT * FROM punches ORDER BY timestamp ASC');

    const punchMap: Record<string, PunchRecord[]> = {};
    for (const p of punchRows) {
      if (!punchMap[p.attendance_id]) {
        punchMap[p.attendance_id] = [];
      }
      punchMap[p.attendance_id].push({
        id: p.id,
        type: p.type as 'IN' | 'OUT',
        time: p.time,
        timestamp: p.timestamp,
      });
    }

    return attRows.map((a: any) => ({
      id: a.id,
      employeeId: a.employee_id,
      name: a.name,
      department: a.department || undefined,
      date: a.date,
      punches: punchMap[a.id] || [],
      totalWorkingHours: a.total_working_hours || undefined,
      status: a.status as 'PRESENT' | 'LATE' | 'HALF_DAY',
    }));
  } catch {
    return [];
  }
}

export function saveAttendanceRecordDb(rec: EmployeeAttendance): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync(
      `INSERT OR REPLACE INTO attendance_records (id, employee_id, name, department, date, status, total_working_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.id,
        rec.employeeId,
        rec.name,
        rec.department || null,
        rec.date,
        rec.status,
        rec.totalWorkingHours || null,
      ]
    );

    // Sync punches
    db.runSync('DELETE FROM punches WHERE attendance_id = ?', [rec.id]);
    for (const p of rec.punches) {
      db.runSync(
        `INSERT INTO punches (id, attendance_id, employee_id, date, type, time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.id, rec.id, rec.employeeId, rec.date, p.type, p.time, p.timestamp]
      );
    }
  } catch {}
}

export function removePunchDb(employeeId: string, date: string, punchId: string): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('DELETE FROM punches WHERE id = ?', [punchId]);

    const attRow = db.getFirstSync<any>('SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?', [employeeId, date]);
    if (attRow) {
      const remainingPunches = db.getAllSync<any>('SELECT * FROM punches WHERE attendance_id = ? ORDER BY timestamp ASC', [attRow.id]);
      if (remainingPunches.length === 0) {
        db.runSync('DELETE FROM attendance_records WHERE id = ?', [attRow.id]);
      }
    }
  } catch {}
}

export function clearAllAttendanceDb(): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('DELETE FROM punches');
    db.runSync('DELETE FROM attendance_records');
  } catch {}
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export function getShiftsDb(): ShiftEntry[] {
  const db = getDb();
  if (!db) return DEFAULT_SHIFTS;
  try {
    const rows = db.getAllSync<any>('SELECT * FROM shifts');
    if (rows.length === 0) {
      saveShiftsDb(DEFAULT_SHIFTS);
      return DEFAULT_SHIFTS;
    }
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      startHour: r.start_hour,
      startMin: r.start_min,
      endHour: r.end_hour,
      endMin: r.end_min,
      lateCutoffHour: r.late_cutoff_hour,
      lateCutoffMin: r.late_cutoff_min,
      isActive: Boolean(r.is_active),
    }));
  } catch {
    return DEFAULT_SHIFTS;
  }
}

export function saveShiftsDb(shifts: ShiftEntry[]): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('DELETE FROM shifts');
    for (const s of shifts) {
      db.runSync(
        `INSERT INTO shifts (id, name, start_hour, start_min, end_hour, end_min, late_cutoff_hour, late_cutoff_min, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.name,
          s.startHour,
          s.startMin,
          s.endHour,
          s.endMin,
          s.lateCutoffHour,
          s.lateCutoffMin,
          s.isActive ? 1 : 0,
        ]
      );
    }
  } catch {}
}

// ── Departments ──────────────────────────────────────────────────────────────

export function getDepartmentsDb(): string[] {
  const db = getDb();
  if (!db) return DEFAULT_DEPARTMENTS;
  try {
    const rows = db.getAllSync<{ name: string }>('SELECT name FROM departments ORDER BY name ASC');
    if (rows.length === 0) {
      saveDepartmentsDb(DEFAULT_DEPARTMENTS);
      return DEFAULT_DEPARTMENTS;
    }
    return rows.map((r: { name: string }) => r.name);
  } catch {
    return DEFAULT_DEPARTMENTS;
  }
}

export function saveDepartmentsDb(depts: string[]): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('DELETE FROM departments');
    for (const name of depts) {
      db.runSync('INSERT OR IGNORE INTO departments (name) VALUES (?)', [name]);
    }
  } catch {}
}

// ── Custom Fields ─────────────────────────────────────────────────────────────

export function getCustomFieldsDb(): CustomField[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.getAllSync<any>('SELECT * FROM custom_fields');
    return rows.map((r: any) => ({
      id: r.id,
      label: r.label,
      key: r.key_name,
      inputType: r.input_type as any,
      isRequired: Boolean(r.is_required),
    }));
  } catch {
    return [];
  }
}

export function saveCustomFieldsDb(fields: CustomField[]): void {
  const db = getDb();
  if (!db) return;
  try {
    db.runSync('DELETE FROM custom_fields');
    for (const f of fields) {
      db.runSync(
        `INSERT INTO custom_fields (id, label, key_name, input_type, is_required)
         VALUES (?, ?, ?, ?, ?)`,
        [f.id, f.label, f.key, f.inputType, f.isRequired ? 1 : 0]
      );
    }
  } catch {}
}

// ── Admin Accounts & Password ──────────────────────────────────────────────────

export interface AdminAccountDb {
  id: string;
  name: string;
  loginId: string;
  password: string;
  role: 'SUPER_ADMIN' | 'HR_MANAGER' | 'HR_STAFF';
  createdAt: string;
  companyEmail?: string;
  companyName?: string;
}

const DEFAULT_ADMIN_DB: AdminAccountDb = {
  id: 'admin-root',
  name: 'Default Admin',
  loginId: 'admin',
  password: 'admin',
  role: 'SUPER_ADMIN',
  createdAt: new Date().toISOString(),
  companyEmail: 'admin@company.com',
  companyName: 'Visagel Enterprise',
};

export function getAdminAccountsDb(): AdminAccountDb[] {
  const val = getKeyValue('admin_accounts');
  if (!val) {
    saveAdminAccountsDb([DEFAULT_ADMIN_DB]);
    return [DEFAULT_ADMIN_DB];
  }
  try {
    const list = JSON.parse(val);
    if (Array.isArray(list) && list.length > 0) {
      return list.map((a: AdminAccountDb) => ({
        ...a,
        companyEmail: a.companyEmail || (a.loginId === 'admin' ? 'admin@company.com' : undefined),
        companyName: a.companyName || (a.loginId === 'admin' ? 'Visagel Enterprise' : undefined),
      }));
    }
    return [DEFAULT_ADMIN_DB];
  } catch {
    return [DEFAULT_ADMIN_DB];
  }
}

export function saveAdminAccountsDb(accounts: AdminAccountDb[]): void {
  setKeyValue('admin_accounts', JSON.stringify(accounts));
}

// ── AI Settings ───────────────────────────────────────────────────────────────

export function getAiSettingsDb(): AiModelSettings {
  const val = getKeyValue('ai_settings');
  if (!val) {
    setKeyValue('ai_settings', JSON.stringify(DEFAULT_AI_SETTINGS));
    return DEFAULT_AI_SETTINGS;
  }
  try {
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(val) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettingsDb(settings: Partial<AiModelSettings>): void {
  let current = DEFAULT_AI_SETTINGS;
  const val = getKeyValue('ai_settings');
  if (val) {
    try {
      current = { ...DEFAULT_AI_SETTINGS, ...JSON.parse(val) };
    } catch {}
  }
  const updated = { ...current, ...settings };
  setKeyValue('ai_settings', JSON.stringify(updated));
}

// ── Organisation Platform Provider Account ────────────────────────────────────

export interface OrgPlatformAccount {
  orgId: string;
  orgEmail: string;
  password?: string;
  isLoggedIn: boolean;
  providerName: string;
  connectedAt?: string;
  companyName?: string;
}

export const DEFAULT_ORG_PLATFORM: OrgPlatformAccount = {
  orgId: 'BRZ-ORG-8821',
  orgEmail: 'admin@branzept.com',
  password: 'admin',
  isLoggedIn: true,
  providerName: 'Branzept Cloud Platform',
  connectedAt: new Date().toISOString(),
  companyName: 'Branzept',
};

export function deriveCompanyName(email?: string, orgId?: string): string {
  if (!email || !email.includes('@')) {
    return orgId || 'Organisation';
  }
  const domain = email.split('@')[1] || '';
  const namePart = domain.split('.')[0] || '';
  if (!namePart) return orgId || 'Organisation';
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

export function getOrgPlatformAccountDb(): OrgPlatformAccount {
  const val = getKeyValue('org_platform_account');
  if (!val) {
    saveOrgPlatformAccountDb(DEFAULT_ORG_PLATFORM);
    return DEFAULT_ORG_PLATFORM;
  }
  try {
    return { ...DEFAULT_ORG_PLATFORM, ...JSON.parse(val) };
  } catch {
    return DEFAULT_ORG_PLATFORM;
  }
}

export function saveOrgPlatformAccountDb(acc: OrgPlatformAccount): void {
  setKeyValue('org_platform_account', JSON.stringify(acc));
}

export function logoutOrgPlatformAccountDb(): OrgPlatformAccount {
  const loggedOut: OrgPlatformAccount = {
    orgId: '',
    orgEmail: '',
    password: '',
    isLoggedIn: false,
    providerName: 'Branzept Cloud Platform',
    connectedAt: '',
    companyName: '',
  };
  saveOrgPlatformAccountDb(loggedOut);
  return loggedOut;
}



