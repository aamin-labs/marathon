import { describe, expect, it } from 'vitest'
import { parseItem } from './parse'
import { useStore, type Shoe, type Workout } from './store'
import { canCorrectDistanceAndTime, countedKm, defaultShoeId, hasBeenWorn, hasSeveralSteps, isRun, isStillToRun, shoeKm, workoutState } from './workout'

const S = { goalTime: '3:30:00', easyLo: 70, easyHi: 80 }

/** A workout on a day, from its text. `done` is the result when it has been marked Done. */
const workout = (text: string, date = '2026-11-10', done?: Workout['done']): Workout => ({ ...parseItem(text)!, id: `${text} on ${date}`, date, done })

/** Put these workouts and shoes in the store, with the paces the planned distances here are worked out from. */
const load = (workouts: Workout[], shoes: Shoe[] = []) => useStore.setState({ workouts, shoes, settings: { ...useStore.getState().settings, ...S } })
/** The workout as the store now holds it. */
const stored = (id: string) => useStore.getState().workouts.find((w) => w.id === id)!

describe('questions about a workout', () => {
  it('counts everything except a strength session as a run', () => {
    expect(isRun(workout('Easy 10k'))).toBe(true)
    expect(isRun(workout('Long 24k'))).toBe(true)
    expect(isRun(workout('Workout 3k @easy, 4x(1k @105%, 2min @easy)'))).toBe(true)
    expect(isRun(workout('Race 42.195k'))).toBe(true)
    expect(isRun(workout('Strength A'))).toBe(false)
  })

  it('gives its state: planned until it is marked Done', () => {
    expect(workoutState(workout('Easy 10k'))).toBe('planned')
    expect(workoutState(workout('Easy 10k', '2026-11-10', { km: 10.2, sec: 3600 }))).toBe('done')
    // A Done strength session records no distance or time, and is Done all the same.
    expect(workoutState(workout('Strength A', '2026-11-10', { km: 0, sec: 0 }))).toBe('done')
  })

  it('is still to be run when it is a run that is not Done', () => {
    expect(isStillToRun(workout('Easy 10k'))).toBe(true)
    expect(isStillToRun(workout('Easy 10k', '2026-11-10', { km: 10, sec: 0 }))).toBe(false)
    expect(isStillToRun(workout('Strength A'))).toBe(false)
  })

  it('counts the planned distance until it is Done, and the Done distance after', () => {
    expect(countedKm(workout('Easy 10k'), S)).toBe(10)
    expect(countedKm(workout('Easy 10k', '2026-11-10', { km: 10.2, sec: 3600 }), S)).toBe(10.2)
    // A run cut short counts as what was run, not what was planned.
    expect(countedKm(workout('Long 24k', '2026-11-10', { km: 0, sec: 0 }), S)).toBe(0)
    expect(countedKm(workout('Strength A'), S)).toBe(0)
  })
})

describe('default shoes', () => {
  const daily: Shoe = { id: 'daily', name: 'Daily trainer', startKm: 0, retired: false }
  const racer: Shoe = { id: 'racer', name: 'Racer', startKm: 0, retired: false }

  it('are the pair worn on the most recent Done run by day, wherever it sits in the list', () => {
    const workouts = [
      workout('Easy 8k', '2026-11-03', { km: 8, sec: 0, shoeId: 'daily' }),
      workout('Workout 10k', '2026-11-08', { km: 10, sec: 0, shoeId: 'racer' }),
      workout('Easy 10k', '2026-11-05', { km: 10, sec: 0, shoeId: 'daily' }),
      workout('Long 24k', '2026-11-12'), // planned, so not yet worn
    ]
    expect(defaultShoeId(workouts, [daily, racer])).toBe('racer')
  })

  it('are none when the pair last worn has been retired', () => {
    const workouts = [
      workout('Easy 8k', '2026-11-03', { km: 8, sec: 0, shoeId: 'daily' }),
      workout('Workout 10k', '2026-11-08', { km: 10, sec: 0, shoeId: 'racer' }),
    ]
    // Not the pair before it either: the suggestion is the last pair worn or nothing.
    expect(defaultShoeId(workouts, [daily, { ...racer, retired: true }])).toBeUndefined()
    // A pair that is no longer in the list is not suggested.
    expect(defaultShoeId(workouts, [daily])).toBeUndefined()
  })

  it('are none when no run is Done', () => {
    expect(defaultShoeId([workout('Easy 8k'), workout('Long 24k', '2026-11-12')], [daily, racer])).toBeUndefined()
    expect(defaultShoeId([], [daily, racer])).toBeUndefined()
  })
})

describe('correcting a result', () => {
  const daily: Shoe = { id: 'daily', name: 'Daily trainer', startKm: 0, retired: false }
  const racer: Shoe = { id: 'racer', name: 'Racer', startKm: 0, retired: false }

  it('allows the distance and time to be corrected, unless the result came with laps', () => {
    expect(canCorrectDistanceAndTime(workout('Easy 10k', '2026-11-10', { km: 10, sec: 0 }))).toBe(true)
    const laps = [{ km: 2, sec: 780, work: false }, { km: 1, sec: 280, work: true }]
    expect(canCorrectDistanceAndTime(workout('Workout 2k @easy, 1k @105%', '2026-11-10', { km: 3, sec: 1060, laps }))).toBe(false)
  })

  it('changes its distance, time, shoes and note, one at a time or together', () => {
    const run = workout('Easy 10k', '2026-11-10', { km: 10, sec: 0, shoeId: 'daily' })
    load([run], [daily, racer])
    const { correctResult } = useStore.getState()
    correctResult(run.id, { km: 10.4 })
    correctResult(run.id, { sec: 3150 })
    expect(stored(run.id).done).toEqual({ km: 10.4, sec: 3150, shoeId: 'daily' })
    correctResult(run.id, { shoeId: 'racer', note: 'Windy' })
    expect(stored(run.id).done).toEqual({ km: 10.4, sec: 3150, shoeId: 'racer', note: 'Windy' })
    // Choosing no shoes and emptying the note take them off again.
    correctResult(run.id, { shoeId: undefined, note: undefined })
    expect(stored(run.id).done).toEqual({ km: 10.4, sec: 3150 })
  })

  it('does nothing on a workout that is not Done', () => {
    const run = workout('Easy 10k')
    load([run], [daily, racer])
    useStore.getState().correctResult(run.id, { km: 10.4, sec: 3150, shoeId: 'racer', note: 'Windy' })
    expect(workoutState(stored(run.id))).toBe('planned')
    expect(stored(run.id)).toEqual(run)
  })
})

describe('steps', () => {
  it('has more than one step when it is written in parts or repeats', () => {
    expect(hasSeveralSteps(workout('Easy 10k'))).toBe(false)
    expect(hasSeveralSteps(workout('Workout 3k @easy, 5k @MP'))).toBe(true)
    expect(hasSeveralSteps(workout('Workout 6x(1k @105%, 2min @easy)'))).toBe(true)
    expect(hasSeveralSteps(workout('Strength A'))).toBe(false)
  })
})

describe('a pair of shoes', () => {
  const daily: Shoe = { id: 'daily', name: 'Daily trainer', startKm: 120, retired: false }
  const racer: Shoe = { id: 'racer', name: 'Racer', startKm: 0, retired: false }
  const workouts = [
    workout('Easy 8k', '2026-11-03', { km: 8.1, sec: 0, shoeId: 'daily' }),
    workout('Easy 10k', '2026-11-05', { km: 10.4, sec: 0, shoeId: 'daily' }),
    workout('Easy 6k', '2026-11-06', { km: 6, sec: 0 }), // Done with no shoes picked
    workout('Long 24k', '2026-11-12'),
  ]

  it('carries its starting distance plus every Done run worn in it', () => {
    expect(shoeKm(daily, workouts)).toBeCloseTo(138.5)
    expect(shoeKm(racer, workouts)).toBe(0)
  })

  it('has been worn once a Done run was run in it', () => {
    expect(hasBeenWorn(daily, workouts)).toBe(true)
    expect(hasBeenWorn(racer, workouts)).toBe(false)
  })
})

describe('marking a workout Done', () => {
  const daily: Shoe = { id: 'daily', name: 'Daily trainer', startKm: 0, retired: false }
  const lastRun = workout('Easy 8k', '2026-11-08', { km: 8, sec: 2880, shoeId: 'daily' })

  it('as planned records, for a run, the planned distance to 0.1 km, no time and the default shoes', () => {
    // 52 minutes at the middle of the easy range (6:40 /km) is 7.80 km and a little.
    const run = workout('Easy 52min')
    load([lastRun, run], [daily])
    useStore.getState().markDoneAsPlanned(run.id)
    expect(workoutState(stored(run.id))).toBe('done')
    expect(stored(run.id).done).toEqual({ km: 7.8, sec: 0, shoeId: 'daily' })
    expect(stored(lastRun.id)).toEqual(lastRun)
  })

  it('as planned records, for a strength session, no distance, no time and no shoes', () => {
    const strength = workout('Strength A')
    load([lastRun, strength], [daily])
    useStore.getState().markDoneAsPlanned(strength.id)
    expect(workoutState(stored(strength.id))).toBe('done')
    expect(stored(strength.id).done).toEqual({ km: 0, sec: 0 })
    // It adds nothing to the shoes last worn.
    expect(shoeKm(daily, useStore.getState().workouts)).toBe(8)
  })

  it('with a recorded result keeps the recorded distance to 0.01 km, the time and the laps, and uses the default shoes', () => {
    const reps = workout('Workout 2k @easy, 3x(1k @105%, 2min @easy), 1k @easy')
    const laps = [{ km: 2, sec: 780, work: false }, { km: 1, sec: 280, work: true }]
    load([lastRun, reps], [daily])
    useStore.getState().markDoneWithResult(reps.id, { km: 9.0449, sec: 3000, laps })
    expect(workoutState(stored(reps.id))).toBe('done')
    expect(stored(reps.id).done).toEqual({ km: 9.04, sec: 3000, shoeId: 'daily', laps })
  })
})

describe('marking a workout not Done', () => {
  it('discards the result, and an earlier result can be put back', () => {
    const laps = [{ km: 2.1, sec: 800, work: false }, { km: 1.1, sec: 300, work: true }]
    const result = { km: 3.2, sec: 1100, shoeId: 'daily', note: 'Felt strong', laps }
    const run = workout('Workout 2k @easy, 1k @105%', '2026-11-10', result)
    load([run])
    useStore.getState().markNotDone(run.id)
    expect(workoutState(stored(run.id))).toBe('planned')
    expect(stored(run.id).done).toBeUndefined()
    expect(countedKm(stored(run.id), S)).toBe(3) // back to the planned distance: 2 km + 1 km

    useStore.getState().putBackResult(run.id, result)
    expect(workoutState(stored(run.id))).toBe('done')
    expect(stored(run.id)).toEqual(run)
  })
})
