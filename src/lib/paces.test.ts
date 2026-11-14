import { describe, expect, it } from 'vitest'
import { fmtClock, type PaceSettings } from './pace'
import { stepsWithPaces, trainingPaces } from './paces'
import { parseItem } from './parse'
import { plannedKm, type Workout } from './store'

const S: PaceSettings = { goalTime: '3:30:00', easyLo: 70, easyHi: 80 }

const workout = (text: string): Workout => ({ ...parseItem(text)!, id: 'w', date: '2026-11-14' })

/** Every step's pace range as the screens would write it, repeats kept as their own lists. Null marks a step with no pace. */
const written = (w: Workout, s = S) => stepsWithPaces(w, s).map((b) => b.steps.map((step) => step.paces && step.paces.map(fmtClock)))

describe("a workout's steps with their paces", () => {
  it('turns a 3:30:00 goal into 4:59 per km marathon pace', () => {
    expect(written(workout('Workout 10k @MP'))).toEqual([[['4:59', '4:59']]])
  })

  it('treats percentages as speed, so 105% is faster than marathon pace', () => {
    expect(written(workout('Workout 5k @100-105%'))).toEqual([[['4:44', '4:59']]])
  })

  it('takes the easy range from the easy percentages', () => {
    // 80% of marathon speed is 4:59 ÷ 0.8, and 70% is 4:59 ÷ 0.7.
    expect(written(workout('Easy 10k'))).toEqual([[['6:13', '7:07']]])
    expect(written(workout('Easy 10k'), { ...S, easyLo: 60, easyHi: 75 })).toEqual([[['6:38', '8:18']]])
  })

  it('works out 5K paces from the 5K time entered', () => {
    // A 20:00 5K is 4:00/km, so 90–92% of that speed is 4:21–4:27/km.
    expect(written(workout('Workout 3min @90-92% 5k'), { ...S, fiveK: '20:00' })).toEqual([[['4:21', '4:27']]])
  })

  it('estimates 5K pace from the goal time when no 5K time is entered', () => {
    // Marathon speed is taken as 81% of 5K speed, so 5K pace is 4:59 × 0.81 and 81% of it is marathon pace again.
    expect(written(workout('Workout 3min @100% 5k, 3min @81% 5k'))).toEqual([[['4:02', '4:02']], [['4:59', '4:59']]])
    expect(written(workout('Workout 3min @100% 5k'), { ...S, fiveK: '' })).toEqual([[['4:02', '4:02']]])
  })

  it('passes a set pace through as written', () => {
    expect(stepsWithPaces(workout('Workout 2min @4:30-4:40, 1k @4:10'), S).map((b) => b.steps[0].paces)).toEqual([[270, 280], [250, 250]])
  })

  it('gives no range to steps run by feel, walking, strides and progressions', () => {
    expect(written(workout('Workout 2k, 1k @feel, 1min @walk, 20s @strides, 8k @progression'))).toEqual([[null], [null], [null], [null], [null]])
  })

  it('keeps the repeats and steps as planned, each step with its amount and target', () => {
    expect(stepsWithPaces(workout('Workout "Threshold": 3k @easy, 5x(1.6k @4:40, 90s @feel), 2min'), S)).toEqual([
      { reps: 1, steps: [{ km: 3, target: { t: 'easy' }, paces: [expect.closeTo(373.27, 2), expect.closeTo(426.59, 2)] }] },
      {
        reps: 5,
        steps: [
          { km: 1.6, target: { t: 'pace', lo: 280, hi: 280 }, paces: [280, 280] },
          { sec: 90, target: { t: 'none' }, paces: null },
        ],
      },
      { reps: 1, steps: [{ sec: 120, target: { t: 'none' }, paces: null }] },
    ])
  })

  it('slows every range by the same share in the heat, set paces included', () => {
    const w = workout('Workout 2k @easy, 3x(1k @MP, 3min @100% 5k, 400m @4:30-4:40, 1min @walk)')
    // 38°C with a 30°C dew point is past the end of the heat chart, which stops at 10%.
    const hot = stepsWithPaces({ ...w, heat: { tempC: 38, dewC: 30 } }, S)
    expect(hot[1].steps[2].paces).toEqual([expect.closeTo(297), expect.closeTo(308)])
    expect(hot[1].steps[3].paces).toBeNull()
    const cool = stepsWithPaces(w, S)
    const shares = hot.flatMap((b, i) => b.steps.flatMap((step, j) => (step.paces ?? []).map((p, k) => p / cool[i].steps[j].paces![k])))
    expect(shares).toHaveLength(8)
    shares.forEach((share) => expect(share).toBeCloseTo(1.1))
  })
})

describe('the planned-distance estimate', () => {
  it('does not move with the weather', () => {
    // 30 minutes at 4:59/km is a little over 6 km, and 10 minutes at the middle of the easy range (6:40/km) is 1.5 km.
    const w = workout('Workout 30min @MP, 10min')
    const hot: Workout = { ...w, heat: { tempC: 38, dewC: 30 } }
    expect(plannedKm(w, S)).toBeCloseTo(7.53, 2)
    expect(plannedKm(hot, S)).toBeCloseTo(7.53, 2)
  })
})

describe('the training paces for a set of settings', () => {
  it('gives marathon pace, the easy range and the 5K pace from the 5K time entered', () => {
    const p = trainingPaces({ ...S, fiveK: '20:00' })
    expect(fmtClock(p.marathon)).toBe('4:59')
    expect(p.easy.map(fmtClock)).toEqual(['6:13', '7:07'])
    expect(p.fiveK).toBe(240)
    expect(p.fiveKEstimated).toBe(false)
  })

  it('says the 5K pace is an estimate when no 5K time is entered', () => {
    for (const s of [S, { ...S, fiveK: '' }, { ...S, fiveK: '  ' }]) {
      const p = trainingPaces(s)
      expect(fmtClock(p.fiveK)).toBe('4:02')
      expect(p.fiveKEstimated).toBe(true)
    }
  })
})
