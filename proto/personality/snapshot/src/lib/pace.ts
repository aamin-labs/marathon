import type { Target } from './parse'

export const MARATHON_KM = 42.195

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

/** Marathon pace in seconds per km. */
export function mpPace(goalTime: string): number {
  return (parseClock(goalTime) ?? 12600) / MARATHON_KM
}

/** 5K pace in seconds per km. With no 5K time set, assume marathon speed is 81% of 5K speed, the plan book's default conversion. */
export function fiveKPace(s: PaceSettings): number {
  const t = parseClock(s.fiveK ?? '')
  return t ? t / 5 : mpPace(s.goalTime) * 0.81
}

// Percentages are of *speed*, so 105% MP is faster than marathon pace.
const pctToPace = (base: number, pct: number) => base / (pct / 100)

/** [fastest, slowest] pace in sec/km, or null when the step is run by feel. */
export function targetPaces(target: Target, s: PaceSettings, heatPct = 0): [number, number] | null {
  const mp = mpPace(s.goalTime)
  let range: [number, number]
  if (target.t === 'easy') range = [pctToPace(mp, s.easyHi), pctToPace(mp, s.easyLo)]
  else if (target.t === 'mp') range = [pctToPace(mp, target.hi), pctToPace(mp, target.lo)]
  else if (target.t === '5k') range = [pctToPace(fiveKPace(s), target.hi), pctToPace(fiveKPace(s), target.lo)]
  else if (target.t === 'pace') range = [target.lo, target.hi]
  else return null
  const k = 1 + heatPct / 100
  return [range[0] * k, range[1] * k]
}

// Temperature + dew point (both °F) → % to slow down. The widely used chart from coach Mark Hadley.
const HEAT_TABLE: [number, number][] = [
  [100, 0], [110, 0.5], [120, 1], [130, 2], [140, 3], [150, 4.5], [160, 6], [170, 8], [180, 10],
]

/** Percent to slow paces for the given conditions (°C). */
export function heatSlowdown(tempC: number, dewC: number): number {
  const f = (c: number) => (c * 9) / 5 + 32
  const sum = f(tempC) + f(dewC)
  if (sum <= HEAT_TABLE[0][0]) return 0
  for (let i = 1; i < HEAT_TABLE.length; i++) {
    const [x1, y1] = HEAT_TABLE[i]
    if (sum <= x1) {
      const [x0, y0] = HEAT_TABLE[i - 1]
      return y0 + ((sum - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return 10
}

/** How an actual average pace compares with a target range. */
export function verdict(actual: number, [fast, slow]: [number, number]): string {
  if (actual < fast - 2) return `${Math.round(fast - actual)} s/km faster than the target range`
  if (actual > slow + 2) return `${Math.round(actual - slow)} s/km slower than the target range`
  return 'Inside the target range'
}
