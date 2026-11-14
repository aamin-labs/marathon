import { describe, expect, it, vi } from 'vitest'
import { addDays, fmtCountdown, isPlausibleDate, mondayOf, today } from './dates'
import { fetchCompleted, icuDescription, matchRuns } from './intervals'
import { fmtClock, mpPace, parseClock, parseRunTime, targetPaces, verdict } from './pace'
import { parseNumber } from './number'
import { parseItem, parsePlan } from './parse'
import { schedule, useStore } from './store'
import { samplePlan } from './samplePlan'
import { undo, useUndo, withUndo } from './undo'
import { canForecast } from './weather'
import { plannedKm } from './workout'
import breeze80 from '../../marathon-plans/breeze-80.txt?raw'

const S = { goalTime: '3:30:00', easyLo: 70, easyHi: 80 }

describe('pace', () => {
  it('reads and writes clock times', () => {
    expect(parseClock('3:30:00')).toBe(12600)
    expect(parseClock('4:45')).toBe(285)
    expect(parseClock('')).toBeNull()
    expect(fmtClock(12600)).toBe('3:30:00')
    expect(fmtClock(298.6)).toBe('4:59')
  })

  it('turns a 3:30 goal into 4:59/km marathon pace', () => {
    expect(fmtClock(mpPace('3:30:00'))).toBe('4:59')
  })

  it('treats percentages as speed, so 105% is faster than marathon pace', () => {
    const [fast, slow] = targetPaces({ t: 'mp', lo: 100, hi: 105 }, S)!
    expect(fmtClock(slow)).toBe('4:59')
    expect(fmtClock(fast)).toBe('4:44')
  })

  it('slows paces in the heat', () => {
    const cool = targetPaces({ t: 'easy' }, S)!
    const hot = targetPaces({ t: 'easy' }, S, 4)!
    expect(hot[0]).toBeCloseTo(cool[0] * 1.04)
  })

  it('judges an actual pace against the range', () => {
    expect(verdict(300, [290, 310])).toBe('Inside the target range')
    expect(verdict(280, [290, 310])).toBe('10 s/km faster than the target range')
    expect(verdict(325, [290, 310])).toBe('15 s/km slower than the target range')
  })
})

describe('plan text', () => {
  it('reads a simple run', () => {
    const w = parseItem('Easy 10k')!
    expect(w.kind).toBe('easy')
    expect(w.blocks).toEqual([{ reps: 1, steps: [{ km: 10, target: { t: 'easy' } }] }])
  })

  it('reads repeats, titles, metres, minutes and set paces', () => {
    const w = parseItem('Workout "Threshold": 3k @easy, 5x(1.6k @103-106%, 400m @easy), 2min @4:30-4:40, 3k')!
    expect(w.title).toBe('Threshold')
    expect(w.kind).toBe('quality')
    expect(w.blocks[1]).toEqual({
      reps: 5,
      steps: [
        { km: 1.6, target: { t: 'mp', lo: 103, hi: 106 } },
        { km: 0.4, target: { t: 'easy' } },
      ],
    })
    expect(w.blocks[2].steps[0]).toEqual({ sec: 120, target: { t: 'pace', lo: 270, hi: 280 } })
    expect(w.blocks[3].steps[0].target).toEqual({ t: 'none' })
    expect(plannedKm(w, S)).toBeGreaterThan(16)
  })

  it('reads rest and strength', () => {
    expect(parseItem('Rest')).toBeNull()
    expect(parseItem('Strength B')!.routine).toBe('B')
  })

  it('explains what is wrong', () => {
    expect(() => parseItem('Jog 5k')).toThrow(/should start with/)
    expect(() => parseItem('Easy 10k @fast')).toThrow(/Can’t read the pace/)
    const { errors } = parsePlan('Mon: Easy 5k\nWeek 1\nTue: Easy ten')
    expect(errors.map((e) => e.line)).toEqual([1, 3])
  })

  it('puts several sessions on one day', () => {
    const { weeks, errors } = parsePlan('Week 1\nTue: Easy 10k + Strength A')
    expect(errors).toEqual([])
    expect(weeks[0][1].map((w) => w.kind)).toEqual(['easy', 'strength'])
  })

  it('writes a workout in intervals.icu format with absolute paces', () => {
    const item = parseItem('Workout "T": 3k @easy, 4x(1.6k @103-106%, 400m @easy), 90s @MP, 2min')!
    const w = { ...item, id: 'x', date: '2026-11-13' }
    expect(icuDescription(w, S)).toBe(
      [
        '- 3km 6:13/km-7:07/km Pace',
        '',
        '4x',
        '- 1.6km 4:42/km-4:50/km Pace',
        '- 400mtr 6:13/km-7:07/km Pace',
        '',
        '- 1m30s 4:59/km Pace',
        '- 2m',
      ].join('\n'),
    )
    const hot = icuDescription({ ...w, heat: { tempC: 27, dewC: 21 } }, S)
    expect(hot.split('\n')[0]).toBe('- 3km 6:30/km-7:26/km Pace')
  })

  it('reads 5K-based paces and steps with no pace', () => {
    const w = parseItem('Workout "Cruise": 2k @easy, 4x(20s @strides, 40s @easy), 6x(3min @90-92% 5k, 1min @walk), 8k @progression')!
    expect(w.blocks[1].steps[0].target).toEqual({ t: 'none', label: 'Strides' })
    expect(w.blocks[2].steps[0].target).toEqual({ t: '5k', lo: 90, hi: 92 })
    // A 20:00 5K is 4:00/km, so 90–92% of that speed is 4:21–4:27/km.
    const [fast, slow] = targetPaces({ t: '5k', lo: 90, hi: 92 }, { ...S, fiveK: '20:00' })!
    expect([fmtClock(fast), fmtClock(slow)]).toEqual(['4:21', '4:27'])
    // With no 5K time, 5K pace comes from the goal time: marathon speed is taken as 81% of 5K speed.
    expect(targetPaces({ t: '5k', lo: 81, hi: 81 }, S)![0]).toBeCloseTo(mpPace(S.goalTime))
    // Walking recoveries add no distance.
    expect(plannedKm(parseItem('Workout 4min @walk, 1k')!, S)).toBe(1)
  })

  it('reads the Breeze 80 plan and lands near the book weekly totals', () => {
    const { weeks, errors } = parsePlan(breeze80)
    expect(errors).toEqual([])
    expect(weeks).toHaveLength(18)
    const s = { goalTime: '4:00:00', fiveK: '23:20', easyLo: 70, easyHi: 80 }
    // Weeks 15 to 17 are a 65–72 km range in the book; race week has no goal.
    const goals = [55, 61, 68, 58, 68, 74, 80, 68, 80, 80, 80, 68, 80, 80, 68.5, 68.5, 68.5]
    const race = weeks[17][6].find((w) => w.kind === 'race')!
    expect(plannedKm(race, s)).toBeCloseTo(42.195)
    const totals = goals.map((_, i) => weeks[i].flat().reduce((sum, w) => sum + plannedKm(w, s), 0))
    totals.forEach((km, i) => expect(Math.abs(km - goals[i]), `week ${i + 1}: ${km.toFixed(1)} km`).toBeLessThanOrEqual(4))
  })

  it('pairs recorded runs with the planned runs on the same day', () => {
    const act = (id: string, date: string, distance: number) => ({ id, start_date_local: `${date}T07:00:00`, type: 'Run', distance, moving_time: 600 })
    const planned = [
      { id: 'tempo', date: '2026-11-04', km: 9 },
      { id: 'am', date: '2026-11-05', km: 12 },
      { id: 'pm', date: '2026-11-05', km: 5 },
      { id: 'missed', date: '2026-11-06', km: 8 },
    ]
    const runs = [act('warmup', '2026-11-04', 1500), act('main', '2026-11-04', 9050), act('short', '2026-11-05', 5100), act('long', '2026-11-05', 12200)]
    const m = matchRuns(planned, runs)
    expect(m.get('tempo')!.map((a) => a.id)).toEqual(['main', 'warmup']) // a separate warm-up counts toward the one planned run
    expect(m.get('am')!.map((a) => a.id)).toEqual(['long'])
    expect(m.get('pm')!.map((a) => a.id)).toEqual(['short'])
    expect(m.has('missed')).toBe(false)
  })

  it('logs fetched runs with their laps, and reports the ones Strava hides', async () => {
    const day = today()
    const easy = { ...parseItem('Easy 8k')!, id: 'easy', date: addDays(day, -1) }
    const reps = { ...parseItem('Workout "Reps": 2k @easy, 3x(1k @105%, 2min @easy), 1k @easy')!, id: 'reps', date: day }
    useStore.setState({ icuKey: 'k', workouts: [easy, reps], shoes: [] })
    const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)))
    const seen: string[] = []
    vi.stubGlobal('fetch', (url: string) => {
      seen.push(url)
      if (url.includes('/activities?'))
        return json([
          { id: 'i1', start_date_local: `${easy.date}T07:00:00`, type: 'Run', distance: 8040, moving_time: 3200, source: 'UPLOAD' },
          { id: 'i2', start_date_local: `${day}T07:00:00`, type: 'Run', distance: 9000, moving_time: 3000, source: 'UPLOAD' },
          { id: 'i3', start_date_local: `${day}T18:00:00`, type: 'Ride', distance: 20000, moving_time: 3000, source: 'UPLOAD' },
          { id: 'i4', start_date_local: `${day}T06:00:00`, source: 'STRAVA' },
        ])
      return json({ icu_intervals: [{ type: 'RECOVERY', distance: 2000, moving_time: 780 }, { type: 'WORK', distance: 1000, moving_time: 280 }] })
    })
    const msg = await fetchCompleted()
    vi.unstubAllGlobals()
    const done = (id: string) => useStore.getState().workouts.find((w) => w.id === id)!.done!
    expect(done('easy')).toMatchObject({ km: 8.04, sec: 3200 })
    expect(done('easy').laps).toBeUndefined() // one-pace run: no laps asked for
    expect(done('reps').laps).toEqual([{ km: 2, sec: 780, work: false }, { km: 1, sec: 280, work: true }])
    expect(seen.filter((u) => u.endsWith('/intervals'))).toEqual(['https://intervals.icu/api/v1/activity/i2/intervals'])
    expect(msg).toMatch(/^Logged 2 runs/)
    expect(msg).toMatch(/1 activity reached intervals.icu through Strava/)
  })

  it('schedules the sample plan to finish on race day', () => {
    const { workouts, errors } = schedule(samplePlan(), '2027-03-14')
    expect(errors).toEqual([])
    const race = workouts.find((w) => w.kind === 'race')!
    expect(race.date).toBe('2027-03-14')
    const first = workouts.map((w) => w.date).sort()[0]
    expect(mondayOf(first)).toBe(addDays('2027-03-08', -17 * 7))
  })
})

describe('fields', () => {
  it('reads a number while it is still being typed', () => {
    expect(parseNumber('25')).toBe(25)
    expect(parseNumber('25.')).toBe(25)
    expect(parseNumber('25.2')).toBe(25.2)
    expect(parseNumber('25,2')).toBe(25.2)
    expect(parseNumber('1,000.5')).toBeNull()
    expect(parseNumber('-0.13')).toBe(-0.13)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('-')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1e3')).toBeNull()
  })

  it('rejects numbers outside the limits', () => {
    expect(parseNumber('23', { min: 0, max: 23, integer: true })).toBe(23)
    expect(parseNumber('24', { min: 0, max: 23, integer: true })).toBeNull()
    expect(parseNumber('7.5', { min: 0, max: 23, integer: true })).toBeNull()
    expect(parseNumber('0', { min: 1 })).toBeNull()
  })

  it('ignores the half-typed years a date field passes through', () => {
    const now = '2026-11-13'
    expect(isPlausibleDate('2027-03-14', now)).toBe(true)
    expect(isPlausibleDate('0002-03-14', now)).toBe(false)
    expect(isPlausibleDate('0202-03-14', now)).toBe(false)
    expect(isPlausibleDate('2100-03-14', now)).toBe(false)
    expect(isPlausibleDate('', now)).toBe(false)
  })
})

describe('the result of a run', () => {
  it('reads the time a run took, and takes an empty field as no time', () => {
    expect(parseRunTime('52:30')).toBe(3150)
    expect(parseRunTime('1:45:00')).toBe(6300)
    expect(parseRunTime('')).toBe(0)
    expect(parseRunTime('  ')).toBe(0)
  })

  it('rejects a time with no colon: "5230" is a slip, not seconds', () => {
    expect(parseRunTime('5230')).toBeNull()
    expect(parseRunTime('52:')).toBeNull()
    expect(parseRunTime('abc')).toBeNull()
  })

  it('rejects minutes or seconds past 59', () => {
    expect(parseRunTime('52:75')).toBeNull()
    expect(parseRunTime('1:75:00')).toBeNull()
    expect(parseRunTime('75:00')).toBe(4500)
  })
})

describe('forecast', () => {
  it('reaches from today to two weeks ahead', () => {
    const now = '2026-11-14'
    expect(canForecast('2026-11-14', now)).toBe(true)
    expect(canForecast('2026-11-28', now)).toBe(true)
    expect(canForecast('2026-11-29', now)).toBe(false)
    expect(canForecast('2026-11-13', now)).toBe(false)
  })
})

describe('dates', () => {
  it('counts down in weeks and days', () => {
    expect(fmtCountdown(17)).toBe('2 weeks and 3 days')
    expect(fmtCountdown(8)).toBe('1 week and 1 day')
    expect(fmtCountdown(14)).toBe('2 weeks')
    expect(fmtCountdown(5)).toBe('5 days')
    expect(fmtCountdown(1)).toBe('1 day')
  })
})

describe('undo', () => {
  it('puts everything back as it was before the last change', () => {
    const { workouts } = schedule('Week 1\nMon: Easy 8k\nTue: Easy 10k', '2027-03-14')
    useStore.setState({ workouts })
    withUndo('Workout removed', () => useStore.getState().removeWorkout(workouts[0].id))
    expect(useStore.getState().workouts).toHaveLength(1)
    expect(useUndo.getState().pending?.label).toBe('Workout removed')
    undo()
    expect(useStore.getState().workouts).toEqual(workouts)
    expect(useUndo.getState().pending).toBeNull()
  })

  it('offers nothing when nothing changed, and withdraws the offer once something else does', () => {
    withUndo('Workout removed', () => useStore.getState().removeWorkout('no such workout'))
    expect(useUndo.getState().pending).toBeNull()

    const { workouts } = useStore.getState()
    withUndo('Workout removed', () => useStore.getState().removeWorkout(workouts[0].id))
    expect(useUndo.getState().pending).not.toBeNull()
    useStore.getState().setSettings({ raceName: 'Dubai' })
    expect(useUndo.getState().pending).toBeNull()
  })
})
