export interface NumberLimits {
  min?: number
  max?: number
  integer?: boolean
}

/** Text from a number field → the number, or null while it isn't one yet ("", "-") or breaks a limit. "25." reads as 25, so a decimal can be typed. A comma counts as the decimal point: phone keypads in many regions have no dot. */
export function parseNumber(text: string, { min = -Infinity, max = Infinity, integer = false }: NumberLimits = {}): number | null {
  // Plain decimals only: Number() alone would also take "1e3" and "0x10".
  const plain = text.trim().replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(plain)) return null
  const n = Number(plain)
  if (!Number.isFinite(n) || n < min || n > max) return null
  if (integer && !Number.isInteger(n)) return null
  return n
}
