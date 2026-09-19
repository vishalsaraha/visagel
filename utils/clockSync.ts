import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export interface PhoneClockInfo {
  timezone: string;
  offsetStr: string;
  label: string;
  lastSynced: string;
  timestamp: number;
}

/**
 * Format a Date to local ISO format YYYY-MM-DD safely without UTC day-shifting.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns formatted phone/device clock info including resolved timezone,
 * GMT offset, and current synchronization status.
 */
export function getPhoneClockInfo(): PhoneClockInfo {
  const now = new Date();
  let tz = 'UTC';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {}

  // Calculate GMT/UTC offset string (e.g. +05:30 or -04:00)
  const offsetMins = -now.getTimezoneOffset();
  const sign = offsetMins >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMins);
  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const offsetStr = `GMT${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  // Short label from timezone
  const tzShort = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
  const label = `${tzShort} (${offsetStr})`;

  const lastSynced = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return {
    timezone: tz,
    offsetStr,
    label,
    lastSynced,
    timestamp: now.getTime(),
  };
}

/**
 * React hook to listen for AppState transitions (e.g. waking up from screen lock / background)
 * to immediately re-sync device clock and shift boundaries without timing drift.
 */
export function usePhoneClockSync(onSync?: (clock: PhoneClockInfo) => void) {
  const [clockInfo, setClockInfo] = useState<PhoneClockInfo>(getPhoneClockInfo);

  const sync = useCallback(() => {
    const info = getPhoneClockInfo();
    setClockInfo(info);
    if (onSync) onSync(info);
  }, [onSync]);

  useEffect(() => {
    // Initial sync
    sync();

    // Re-sync on app resume / foreground
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        sync();
      }
    });

    // Regular 30s background heartbeat sync
    const iv = setInterval(sync, 30000);

    return () => {
      sub.remove();
      clearInterval(iv);
    };
  }, [sync]);

  return { clockInfo, reSyncClock: sync };
}
