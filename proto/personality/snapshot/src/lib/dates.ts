// Dates are kept as local "YYYY-MM-DD" strings so a workout never shifts a day across time zones.

export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => iso(new Date())

export function addDays(s: string, n: number): string {
  const d = fromIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export function mondayOf(s: string): string {
  const dow = (fromIso(s).getDay() + 6) % 7 // Monday = 0
  return addDays(s, -dow)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86400000)
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions): string {
  return fromIso(s).toLocaleDateString('en-GB', opts)
}

/**
 * A date field reports years like 0002 and 0202 while "2027" is being typed. Only act on a finished one:
 * a date within five years of today, which also keeps a slip of the finger from stretching the calendar across decades.
 */
export function isPlausibleDate(s: string, now = today()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Math.abs(daysBetween(now, s)) <= 5 * 366
}

/** 17 → "2 weeks and 3 days". */
export function fmtCountdown(days: number): string {
  const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  const weeks = Math.floor(days / 7)
  const rest = days % 7
  if (weeks === 0) return count(rest, 'day')
  return rest === 0 ? count(weeks, 'week') : `${count(weeks, 'week')} and ${count(rest, 'day')}`
}
