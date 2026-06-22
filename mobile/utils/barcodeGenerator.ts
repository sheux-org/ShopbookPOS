/**
 * Generates a valid 13-digit EAN-13 barcode string.
 * It starts with "29" (the standard prefix for store-specific internal barcodes)
 * followed by 10 random digits, and ending with the mathematically correct EAN-13 check digit.
 */
export function generateEAN13(): string {
  // Generate 12 digits: "29" prefix + 10 random digits
  const baseDigits =
    '29' + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');

  // Calculate modulo-10 EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(baseDigits[i], 10);
    // EAN-13 weight pattern: alternate 1 and 3 (index 0 is odd position, weight 1; index 1 is even position, weight 3)
    sum += i % 2 === 1 ? digit * 3 : digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return baseDigits + checkDigit;
}

/**
 * Validates whether a string is a valid EAN-13 barcode.
 */
export function isValidEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i], 10);
    sum += i % 2 === 1 ? digit * 3 : digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(barcode[12], 10);
}
