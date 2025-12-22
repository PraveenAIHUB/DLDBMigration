/**
 * Phone number formatting utilities
 * Supports international format with country code
 */

/**
 * Formats a phone number as the user types
 * Supports formats like: +971 XX XXX XXXX, +1 (XXX) XXX-XXXX, etc.
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters except +
  let cleaned = value.replace(/[^\d+]/g, '');
  
  // If it starts with +, keep it
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove leading zeros if not starting with +
  if (!hasPlus && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Format based on length
  if (cleaned.length === 0) {
    return hasPlus ? '+' : '';
  }
  
  // For UAE format (+971 XX XXX XXXX)
  if (hasPlus && cleaned.startsWith('971')) {
    const rest = cleaned.substring(3);
    if (rest.length <= 2) {
      return `+971 ${rest}`;
    } else if (rest.length <= 5) {
      return `+971 ${rest.substring(0, 2)} ${rest.substring(2)}`;
    } else if (rest.length <= 9) {
      return `+971 ${rest.substring(0, 2)} ${rest.substring(2, 5)} ${rest.substring(5)}`;
    } else {
      return `+971 ${rest.substring(0, 2)} ${rest.substring(2, 5)} ${rest.substring(5, 9)}`;
    }
  }
  
  // For US/Canada format (+1 XXX XXX XXXX)
  if (hasPlus && cleaned.startsWith('1') && cleaned.length > 1) {
    const rest = cleaned.substring(1);
    if (rest.length <= 3) {
      return `+1 (${rest}`;
    } else if (rest.length <= 6) {
      return `+1 (${rest.substring(0, 3)}) ${rest.substring(3)}`;
    } else {
      return `+1 (${rest.substring(0, 3)}) ${rest.substring(3, 6)}-${rest.substring(6, 10)}`;
    }
  }
  
  // For other international formats with +
  if (hasPlus) {
    if (cleaned.length <= 3) {
      return `+${cleaned}`;
    } else if (cleaned.length <= 6) {
      return `+${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
    } else if (cleaned.length <= 9) {
      return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    } else {
      return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9, 13)}`;
    }
  }
  
  // For local format (without country code)
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  } else if (cleaned.length <= 9) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
  } else {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 10)}`;
  }
}

/**
 * Validates phone number format
 * Accepts international format with + or local format
 */
export function validatePhoneNumber(phone: string): { valid: boolean; message?: string } {
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (!cleaned || cleaned.length < 8) {
    return { valid: false, message: 'Phone number must be at least 8 digits' };
  }
  
  if (cleaned.length > 15) {
    return { valid: false, message: 'Phone number is too long' };
  }
  
  // Check if it starts with + (international format)
  if (cleaned.startsWith('+')) {
    const digits = cleaned.substring(1);
    if (digits.length < 8 || digits.length > 14) {
      return { valid: false, message: 'Invalid international phone number format' };
    }
  }
  
  return { valid: true };
}

/**
 * Normalizes phone number for storage (removes formatting, keeps + if present)
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.trim();
  if (!cleaned) return '';
  
  // Keep + if present, remove all other non-digit characters
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/[^\d]/g, '');
  
  return hasPlus ? `+${digits}` : digits;
}

