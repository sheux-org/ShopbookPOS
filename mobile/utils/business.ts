export const getBusinessInitials = (name: string): string => {
  if (!name) return 'SP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

/**
 * Owner test for entitlement and purchasing.
 *
 * NOT `activeEmployeeId === 'owner'`: registration also creates an employees
 * row carrying the owner's own phone, and useVerifyOtp matches employees
 * before businesses — so an owner logging in is identified as staff. The only
 * reliable signal is the phone on the business itself.
 */
export const isBusinessOwner = (
  userPhone: string | null | undefined,
  businessPhone: string | null | undefined,
  normalize: (p: string) => string
): boolean => {
  if (!userPhone || !businessPhone) return false;
  const a = normalize(userPhone);
  return a.length > 0 && a === normalize(businessPhone);
};
