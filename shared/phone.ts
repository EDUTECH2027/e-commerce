/**
 * Normalises a phone number to the digits-only international format that wa.me expects
 * (e.g. "+237 6 70 00 00 00" -> "237670000000").
 * A bare 9-digit Cameroonian mobile number starting with 6 gets the 237 country code.
 */
export function normalizeWhatsAppNumber(input: string): string {
  let digits = input.replace(/[^\d]/g, '')
  if (input.trim().startsWith('00')) digits = digits.replace(/^00/, '')
  if (digits.length === 9 && digits.startsWith('6')) digits = '237' + digits
  return digits
}

export function isValidWhatsAppNumber(input: string): boolean {
  const n = normalizeWhatsAppNumber(input)
  return n.length >= 8 && n.length <= 15
}
