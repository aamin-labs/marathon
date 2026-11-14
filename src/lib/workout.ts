import { targetPaces, type PaceSettings } from './pace'
import type { Item } from './parse'
import type { Data, Shoe, Workout } from './store'

// What a workout is, and the answers to the questions the rest of the app asks about one.
// Plain logic over plain data: the screens and Watch sync ask here instead of reading a workout's fields themselves.

/** A run is anything except a strength session. */
export const isRun = (w: Item): boolean => w.kind !== 'strength'

export type WorkoutState = 'planned' | 'done'

/** Where the workout stands. A workout is Done once a result is recorded against it; callers ask here instead of looking for the result. */
export const workoutState = (w: Workout): WorkoutState => (w.done ? 'done' : 'planned')

/** A run that is not Done: what Watch sync sends, and fetches results for. */
export const isStillToRun = (w: Workout): boolean => isRun(w) && workoutState(w) !== 'done'

/** Planned distance; timed steps are estimated at the middle of their target pace. */
export function plannedKm(w: Item, s: PaceSettings): number {
  let km = 0
  for (const b of w.blocks)
    for (const step of b.steps) {
      if (step.km != null) km += b.reps * step.km
      else if (step.sec != null) {
        if (step.target.t === 'none' && step.target.label === 'Walk') continue // walking isn't running distance
        const [fast, slow] = targetPaces(step.target, s) ?? targetPaces({ t: 'easy' }, s)!
        km += (b.reps * step.sec) / ((fast + slow) / 2)
      }
    }
  return km
}

/** The distance that counts toward a day or a week: what was run once the workout is Done, what is planned until then. */
export const countedKm = (w: Workout, s: PaceSettings): number => (w.done ? w.done.km : plannedKm(w, s))

/** The shoes to suggest for a run being marked Done: the pair worn on the most recent Done run, by day. None once that pair is retired. */
export function defaultShoeId(workouts: Workout[], shoes: Shoe[]): string | undefined {
  const last = [...workouts].filter((w) => w.done?.shoeId).sort((a, b) => b.date.localeCompare(a.date))[0]?.done?.shoeId
  return shoes.some((s) => s.id === last && !s.retired) ? last : undefined
}

/** Whether the distance and time of its result may be corrected. Not when the result came with laps: they are the watch's, and would stop adding up. */
export const canCorrectDistanceAndTime = (w: Workout): boolean => !w.done?.laps

/** Whether it has more than one step, which is when laps are worth fetching. */
export const hasSeveralSteps = (w: Item): boolean => w.blocks.length > 1 || w.blocks.some((b) => b.reps > 1)

/** The distance on a pair of shoes: what it started with, plus every Done run worn in it. */
export function shoeKm(shoe: Shoe, workouts: Workout[]): number {
  return workouts.reduce((sum, w) => (w.done?.shoeId === shoe.id ? sum + w.done.km : sum), shoe.startKm)
}

/** Whether a pair was worn on any Done run. Such a pair is kept, so those runs keep their shoes. */
export const hasBeenWorn = (shoe: Shoe, workouts: Workout[]): boolean => workouts.some((w) => w.done?.shoeId === shoe.id)

// Changes to a workout. Each takes the workout as it is and gives back the workout as it becomes.
// The store's workout actions are thin calls to these, so a run ticked by hand and a run fetched from the watch are recorded by the same rules.

/** The result recorded against a Done workout. */
export type Result = NonNullable<Workout['done']>

/** A run as it was recorded elsewhere, which is how Watch sync hands one over. */
export type RecordedResult = Pick<Result, 'km' | 'sec' | 'laps'>

/** The parts of a result that may be corrected by hand. Shoes or a note given as nothing are taken off. */
export type ResultCorrection = Partial<Pick<Result, 'km' | 'sec' | 'shoeId' | 'note'>>

/** What a change may need to know beyond the workout itself: the other workouts and the shoes for the default pair, the settings for the planned distance. */
type Rest = Pick<Data, 'workouts' | 'shoes' | 'settings'>

/** Done as planned: one tap records a run at its planned distance to 0.1 km, with no time yet and the default shoes. The details can be corrected after. */
export function markDoneAsPlanned(w: Workout, { workouts, shoes, settings }: Rest): Workout {
  // A strength session has no distance, time or shoes to record, so it adds nothing to running totals or shoe distance.
  if (!isRun(w)) return { ...w, done: { km: 0, sec: 0 } }
  return { ...w, done: { km: Math.round(plannedKm(w, settings) * 10) / 10, sec: 0, shoeId: defaultShoeId(workouts, shoes) } }
}

/** Done with a recorded result: the distance to 0.01 km, the time and the laps as they were recorded, with the same default shoes as a run ticked by hand. */
export function markDoneWithResult(w: Workout, { km, sec, laps }: RecordedResult, { workouts, shoes }: Rest): Workout {
  return { ...w, done: { km: Math.round(km * 100) / 100, sec, shoeId: defaultShoeId(workouts, shoes), laps } }
}

/** Correct the result of a Done workout: its distance, time, shoes or note. A workout that is not Done has no result to correct, and stays as it is. */
export function correctResult(w: Workout, correction: ResultCorrection): Workout {
  if (!w.done) return w
  return { ...w, done: { ...w.done, ...correction } }
}

/** Mark not Done: the result is discarded and the workout is planned again. */
export const markNotDone = (w: Workout): Workout => ({ ...w, done: undefined })

/** Put back a result the workout carried earlier, whole: what a tick after an untick does, and what Undo after an untick starts from. */
export const putBackResult = (w: Workout, result: Result): Workout => ({ ...w, done: result })
