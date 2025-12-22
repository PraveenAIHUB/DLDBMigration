// Dubai timezone utilities
const DUBAI_TIMEZONE = 'Asia/Dubai';

// Format date to Dubai timezone
export const formatDubaiDate = (date: string | Date | null): string => {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    timeZone: DUBAI_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Format date to Dubai timezone (full format)
export const formatDubaiDateTime = (date: string | Date | null): string => {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    timeZone: DUBAI_TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

// Convert UTC date to Dubai local datetime-local format for input fields
export const toDubaiLocalDateTime = (utcDate: string | null): string => {
  if (!utcDate) return '';
  
  const date = new Date(utcDate);
  
  // Convert to Dubai timezone
  const dubaiDate = new Date(date.toLocaleString('en-US', { timeZone: DUBAI_TIMEZONE }));
  
  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  const year = dubaiDate.getFullYear();
  const month = String(dubaiDate.getMonth() + 1).padStart(2, '0');
  const day = String(dubaiDate.getDate()).padStart(2, '0');
  const hours = String(dubaiDate.getHours()).padStart(2, '0');
  const minutes = String(dubaiDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Convert Dubai local datetime-local to UTC for database
export const dubaiLocalToUTC = (localDateTime: string): string | null => {
  if (!localDateTime) return null;
  
  // Parse the datetime-local string (format: YYYY-MM-DDTHH:mm)
  // This string is treated as Dubai time (UTC+4)
  const [datePart, timePart] = localDateTime.split('T');
  if (!datePart || !timePart) return null;
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create a date object treating the input as Dubai time
  // Dubai is UTC+4, so we create a UTC date and then subtract 4 hours
  // to get the actual UTC time
  const dubaiTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  
  // Dubai is UTC+4, so subtract 4 hours to get UTC
  const utcTime = new Date(dubaiTime.getTime() - (4 * 60 * 60 * 1000));
  
  return utcTime.toISOString();
};

// Get current time in Dubai timezone as ISO string (correct UTC instant for Dubai now)
export const getDubaiNow = (): string => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000; // current UTC in ms
  const dubaiMs = utcMs + 4 * 60 * 60 * 1000; // Dubai is UTC+4
  return new Date(dubaiMs).toISOString();
};

// Get current Dubai local datetime string for datetime-local input (optionally with offset minutes)
export const getDubaiLocalInputNow = (offsetMinutes: number = 0): string => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const dubaiMs = utcMs + 4 * 60 * 60 * 1000 + offsetMinutes * 60 * 1000;
  const dubaiDate = new Date(dubaiMs);

  const year = dubaiDate.getFullYear();
  const month = String(dubaiDate.getMonth() + 1).padStart(2, '0');
  const day = String(dubaiDate.getDate()).padStart(2, '0');
  const hours = String(dubaiDate.getHours()).padStart(2, '0');
  const minutes = String(dubaiDate.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Simple date formatter (alias for formatDubaiDate)
export const formatDate = formatDubaiDate;

