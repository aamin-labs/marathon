import { addDays, mondayOf } from './dates'
import type { PaceSettings } from './pace'
import { parseDay, type Item } from './parse'
import type { Workout } from './store'
import { countedKm, workoutState } from './workout'

// How a written plan becomes workouts on the calendar, and how the plan sits there: its weeks, the days in each and the workouts on them.
// Plain logic over plain data: the store saves what comes back, and the screens read weeks from here instead of working them out themselves.

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

/** One day of a week, with the workouts on it in the order they were given. */
export interface Day {
  date: string
  workouts: Workout[]
}

/** One week of the calendar, Monday to Sunday. */
export interface Week {
  number: number
  monday: string
  days: Day[]
  /** Where the week is heading: the distance that counts for each of its workouts, added up. */
  km: number
}

/** The calendar's weeks in order, from the earliest workout's week to the latest. With no workouts there is one week, the current one. */
export function calendarWeeks(workouts: Workout[], today: string, settings: PaceSettings): Week[] {
  const dates = workouts.map((w) => w.date).sort()
  const first = mondayOf(dates[0] ?? today)
  const last = mondayOf(dates[dates.length - 1] ?? today)
  const weeks: Week[] = []
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    const inWeek = workouts.filter((w) => w.date >= monday && w.date <= addDays(monday, 6))
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      return { date, workouts: inWeek.filter((w) => w.date === date) }
    })
    weeks.push({ number: weeks.length + 1, monday, days, km: inWeek.reduce((sum, w) => sum + countedKm(w, settings), 0) })
  }
  return weeks
}

/** The current week's figures for the Today page: the distance the week is heading for, and the distance Done so far. Both are 0 when today is outside the calendar. */
export function currentWeekKm(workouts: Workout[], today: string, settings: PaceSettings): { headingFor: number; done: number } {
  const week = calendarWeeks(workouts, today, settings).find((w) => w.monday === mondayOf(today))
  if (!week) return { headingFor: 0, done: 0 }
  const done = week.days
    .flatMap((d) => d.workouts)
    .filter((w) => workoutState(w) === 'done')
    .reduce((sum, w) => sum + countedKm(w, settings), 0)
  return { headingFor: week.km, done }
}
