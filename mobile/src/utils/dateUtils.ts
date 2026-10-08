/**
 * Shared IST date/time formatting utilities for Mobile App.
 * Enforces DD-MM-YYYY format across all screens, receipts, and PDFs.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +5h 30m = 19,800,000 ms

/**
 * Format timestamp string or Date to IST date only: "DD-MM-YYYY"
 */
export const formatISTDate = (dateStr?: string | Date | null): string => {
  if (!dateStr) return '—';

  try {
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) return '—';
      const istDate = new Date(dateStr.getTime() + IST_OFFSET_MS);
      const day = String(istDate.getUTCDate()).padStart(2, '0');
      const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const year = istDate.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }

    const clean = String(dateStr).trim();
    if (!clean) return '—';

    // Direct plain YYYY-MM-DD
    const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch && !clean.includes('T') && !clean.includes(' ')) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }

    // Direct plain DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch && !clean.includes('T') && !clean.includes(' ')) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${day}-${month}-${year}`;
    }

    // Timestamp with time / timezone
    let parseable = clean;
    if (!parseable.endsWith('Z') && !/[+-]\d{2}(?::?\d{2})?$/.test(parseable)) {
      parseable = parseable.replace(' ', 'T') + 'Z';
    }

    const utcMs = Date.parse(parseable);
    if (isNaN(utcMs)) {
      const fallback = new Date(dateStr);
      if (isNaN(fallback.getTime())) return String(dateStr);
      const day = String(fallback.getDate()).padStart(2, '0');
      const month = String(fallback.getMonth() + 1).padStart(2, '0');
      const year = fallback.getFullYear();
      return `${day}-${month}-${year}`;
    }

    const istDate = new Date(utcMs + IST_OFFSET_MS);
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const year = istDate.getUTCFullYear();

    return `${day}-${month}-${year}`;
  } catch {
    return String(dateStr);
  }
};

/**
 * Format timestamp string to IST datetime: "DD-MM-YYYY, hh:mm am/pm"
 */
export const formatIST = (dateStr?: string | Date | null): string => {
  if (!dateStr) return '—';

  try {
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) return '—';
      const istDate = new Date(dateStr.getTime() + IST_OFFSET_MS);
      const day = String(istDate.getUTCDate()).padStart(2, '0');
      const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const year = istDate.getUTCFullYear();
      let hours = istDate.getUTCHours();
      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
    }

    const clean = String(dateStr).trim();
    if (!clean) return '—';

    let parseable = clean;
    if (!parseable.endsWith('Z') && !/[+-]\d{2}(?::?\d{2})?$/.test(parseable)) {
      parseable = parseable.replace(' ', 'T') + 'Z';
    }

    const utcMs = Date.parse(parseable);
    if (isNaN(utcMs)) {
      const fallback = new Date(dateStr);
      if (isNaN(fallback.getTime())) return String(dateStr);
      const day = String(fallback.getDate()).padStart(2, '0');
      const month = String(fallback.getMonth() + 1).padStart(2, '0');
      const year = fallback.getFullYear();
      return `${day}-${month}-${year}`;
    }

    const istDate = new Date(utcMs + IST_OFFSET_MS);
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const year = istDate.getUTCFullYear();

    let hours = istDate.getUTCHours();
    const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    const hoursStr = String(hours).padStart(2, '0');

    return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return String(dateStr);
  }
};

export const formatDateDMY = formatISTDate;
export const formatDate = formatISTDate;
