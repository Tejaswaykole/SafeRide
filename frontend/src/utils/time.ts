// Indian Standard Time (IST: UTC+05:30) Formatting Utilities

export function getISTNow(): Date {
  return new Date();
}

/**
 * Format timestamp into standard 12-hour IST time: "10:14:22 PM IST"
 */
export function formatISTTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '--:--:--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--:--:--';
  
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
  if (!dateInput) return '--/--/----';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--/--/----';
  
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
  if (!dateInput) return '--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--';
  
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
