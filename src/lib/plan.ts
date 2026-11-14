import { addDays, mondayOf } from './dates'
import type { PaceSettings } from './pace'
import type { Workout } from './store'
import { countedKm, workoutState } from './workout'

// How the plan sits on the calendar: its weeks, the days in each and the workouts on them.
// Plain logic over plain data: the screens read weeks from here instead of working them out themselves.

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
