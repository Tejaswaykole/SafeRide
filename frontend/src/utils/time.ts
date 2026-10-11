// Indian Standard Time (IST: UTC+05:30) Formatting Utilities

export function getISTNow(): Date {
  return new Date();
}

/**
 * Safely parse date input ensuring UTC/ISO timestamps without timezone offset
 * (e.g. from SQLite or Python naive UTC datetimes) are correctly parsed as UTC.
 */
export function parseDateInput(dateInput?: string | number | Date | null): Date | null {
  if (dateInput == null || dateInput === '') return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === 'string') {
    let s = dateInput.trim();
    // Numeric string epoch
    if (/^\d+$/.test(s)) {
      const d = new Date(Number(s));
      return isNaN(d.getTime()) ? null : d;
    }
    // Check if ISO date string lacks timezone offset (e.g. "2026-10-11T09:19:51.803547" or "2026-10-11 09:19:51")
    if ((s.includes('T') || s.includes('-')) && !s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
      if (!s.includes('T') && s.includes(' ')) {
        s = s.replace(' ', 'T');
      }
      s = s + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format timestamp into standard 12-hour IST time: "10:14:22 PM IST"
 */
export function formatISTTime(dateInput?: string | number | Date | null): string {
  const d = parseDateInput(dateInput);
  if (!d) return '--:--:--';
  
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';
}

/**
 * Format date into standard IST date: "09 Oct 2026"
 */
export function formatISTDate(dateInput?: string | number | Date | null): string {
  const d = parseDateInput(dateInput);
  if (!d) return '--/--/----';
  
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format full date and time in IST: "09 Oct 2026, 10:14:22 PM IST"
 */
export function formatISTDateTime(dateInput?: string | number | Date | null): string {
  const d = parseDateInput(dateInput);
  if (!d) return '--';
  
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';
}
