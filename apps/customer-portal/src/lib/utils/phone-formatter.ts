/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 * Handles user input and auto-formats as they type
 */

export function formatPhoneE164(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');

  // If starts with 1, keep it; otherwise assume US number
  const withCountryCode = numbers.startsWith('1') ? numbers : '1' + numbers;

  // Limit to 11 digits (1 + 10 digits)
  const limited = withCountryCode.substring(0, 11);

  // Format as +1XXXXXXXXXX
  if (limited.length > 0) {
    return '+' + limited;
  }

  return '';
}

/**
 * Display formatted phone number (more readable)
 * +1 (555) 123-4567
 */
export function displayPhoneFormatted(e164: string): string {
  // Remove + and country code
  const numbers = e164.replace(/^\+1/, '');

  if (numbers.length === 10) {
    return `+1 (${numbers.substring(0, 3)}) ${numbers.substring(3, 6)}-${numbers.substring(6)}`;
  }

  return e164;
}

/**
 * Validate E.164 phone number
 */
export function validatePhoneE164(phone: string): boolean {
  return /^\+1[0-9]{10}$/.test(phone);
}

/**
 * Handle phone input change with auto-formatting
 */
export function handlePhoneInput(inputValue: string): string {
  return formatPhoneE164(inputValue);
}
