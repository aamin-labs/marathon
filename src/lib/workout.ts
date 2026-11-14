import { targetPaces, type PaceSettings } from './pace'
import type { Item } from './parse'
import type { Shoe, Workout } from './store'

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
