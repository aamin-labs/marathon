import { addDays, mondayOf } from './dates'
import { parseDay, type Item } from './parse'
import type { Workout } from './store'
import { workoutState } from './workout'

// How a written plan becomes workouts on the calendar.
// Plain logic over plain data: the store saves what comes back, and the screens are told the outcome.

export interface PlanError {
  line: number
  msg: string
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Whole plan → weeks[week][day 0-6 from Monday] = workouts. */
function readPlan(text: string): { weeks: Item[][][]; errors: PlanError[] } {
  const weeks: Item[][][] = []
  const errors: PlanError[] = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    if (/^week\b/i.test(line)) {
      weeks.push(DAYS.map(() => []))
      return
    }
    const day = line.match(/^([a-z]{3})[a-z]*\s*:\s*(.*)$/i)
    const di = day ? DAYS.indexOf(day[1].toLowerCase()) : -1
    if (!day || di < 0) {
      errors.push({ line: i + 1, msg: `“${line}” should be “Week 1” or a day like “Mon: Easy 10k”.` })
      return
    }
    if (!weeks.length) {
      errors.push({ line: i + 1, msg: 'Start with a “Week 1” line before the first day.' })
      return
    }
    try {
      weeks[weeks.length - 1][di].push(...parseDay(day[2]))
    } catch (e) {
      errors.push({ line: i + 1, msg: (e as Error).message })
    }
  })
  return { weeks, errors }
}

/** What laying a plan gives back: the plan's mistakes and nothing else, or the new set of workouts with the number of weeks. */
export type LaidPlan = { errors: PlanError[] } | { workouts: Workout[]; weeks: number }

/**
 * Lay the written plan onto the calendar so its last week contains race day.
 * `existing` is what is on the calendar now: Done workouts stay, and every other workout is replaced by the written ones.
 */
export function layPlan(planText: string, raceDate: string, existing: Workout[]): LaidPlan {
  const { weeks, errors } = readPlan(planText)
  if (errors.length) return { errors }
  const start = addDays(mondayOf(raceDate), -(weeks.length - 1) * 7)
  const written = weeks.flatMap((days, wi) =>
    days.flatMap((items, di) => items.map((item) => ({ ...item, id: crypto.randomUUID(), date: addDays(start, wi * 7 + di) }))),
  )
  // Done workouts are history: keep them, and don't plan the same kind of workout again on that day.
  const done = existing.filter((w) => workoutState(w) === 'done')
  const fresh = written.filter((w) => !done.some((d) => d.date === w.date && d.kind === w.kind))
  return { workouts: [...done, ...fresh], weeks: weeks.length }
}
