/** "3:30:00" or "4:45" → seconds. */
export function parseClock(s: string): number | null {
  if (!s.trim()) return null
  const parts = s.trim().split(':').map(Number)
  if (parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

/** The time typed for a run that is done → seconds. An empty field is 0, meaning no time was recorded. */
export function parseRunTime(text: string): number | null {
  if (!text.trim()) return 0
  // A time with no colon is a slip, not seconds: "5230" would otherwise be read as 1:27:10.
  if (!/^\d+:[0-5]\d(:[0-5]\d)?$/.test(text.trim())) return null
  return parseClock(text)
}

export function fmtClock(sec: number): string {
  const t = Math.round(sec)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(t % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export const fmtKm = (km: number) => (Math.round(km * 10) / 10).toString()

export interface PaceSettings {
  goalTime: string
  /** Current 5K time. Optional: data saved before this setting existed doesn't have it. */
  fiveK?: string
  easyLo: number
  easyHi: number
}

/** How an actual average pace compares with a target range. */
export function verdict(actual: number, [fast, slow]: [number, number]): string {
  if (actual < fast - 2) return `${Math.round(fast - actual)} s/km faster than the target range`
  if (actual > slow + 2) return `${Math.round(actual - slow)} s/km slower than the target range`
  return 'Inside the target range'
}
