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
