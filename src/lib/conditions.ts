import type { Workout } from './store'

// The conditions on a workout, and the one answer everything else needs from them: how much the workout is slowed.

// Temperature + dew point (both °F) → % to slow down. The widely used chart from coach Mark Hadley.
const HEAT_TABLE: [number, number][] = [
  [100, 0], [110, 0.5], [120, 1], [130, 2], [140, 3], [150, 4.5], [160, 6], [170, 8], [180, 10],
]

/** Percent to slow the workout's paces for the conditions saved on it (°C). A workout with no conditions is not slowed. */
export function slowdown(w: Pick<Workout, 'heat'>): number {
  if (!w.heat) return 0
  const f = (c: number) => (c * 9) / 5 + 32
  const sum = f(w.heat.tempC) + f(w.heat.dewC)
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
