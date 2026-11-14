import { describe, expect, it } from 'vitest'
import { slowdown } from './conditions'
import { parseItem } from './parse'
import type { Workout } from './store'

const run: Workout = { ...parseItem('Easy 10k')!, id: 'run', date: '2026-11-14' }

describe('how much a workout is slowed', () => {
  it('does not slow a workout with no conditions', () => {
    expect(slowdown(run)).toBe(0)
  })

  it('slows a workout in hot conditions by what the chart says', () => {
    // 25°C is 77°F and 18°C is 64.4°F: 141.4 on the chart, a little past the 3% line at 140 on the way to 4.5% at 150.
    expect(slowdown({ ...run, heat: { tempC: 25, dewC: 18 } })).toBeCloseTo(3.21, 2)
    // 38°C and 30°C come to 186.4, past the end of the chart, which stops at 10%.
    expect(slowdown({ ...run, heat: { tempC: 38, dewC: 30 } })).toBe(10)
  })

  it('does not slow a workout in mild conditions', () => {
    // 10°C is 50°F and 5°C is 41°F: 91, below where the chart starts at 100.
    expect(slowdown({ ...run, heat: { tempC: 10, dewC: 5 } })).toBe(0)
  })
})
