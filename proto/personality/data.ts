// Throwaway prototype code: the numbers every variant draws from, worked out once.
import { useMemo } from 'react'
import { addDays, mondayOf, today } from './snapshot/src/lib/dates'
import { targetPaces, type PaceSettings } from './snapshot/src/lib/pace'
import type { Item, Kind } from './snapshot/src/lib/parse'
import { plannedKm, useStore, type Workout } from './snapshot/src/lib/store'

export const KIND_NAMES: Record<Kind, string> = { easy: 'Easy', long: 'Long run', quality: 'Quality', race: 'Race', strength: 'Strength' }

/** One stretch of a workout, repeats written out: how far, at what pace, and how hard on a 0–1 scale. */
export function effort(w: Item, s: PaceSettings): { km: number; pace: number; level: number }[] {
  const easy = targetPaces({ t: 'easy' }, s)!
  const easyMid = (easy[0] + easy[1]) / 2
  const out: { km: number; pace: number; level: number }[] = []
  for (const b of w.blocks)
    for (let r = 0; r < b.reps; r++)
      for (const step of b.steps) {
        const p = targetPaces(step.target, s)
        const label = step.target.t === 'none' ? step.target.label : undefined
        const pace = p ? (p[0] + p[1]) / 2 : label === 'Walk' ? easyMid * 1.6 : label === 'Strides' ? easyMid * 0.7 : easyMid
        const km = step.km ?? (step.sec ?? 0) / pace
        // Speed relative to easy pace: a walk sits near the floor, easy around 0.4, marathon pace 0.7, 5K pace near the top.
        const level = Math.min(1, Math.max(0.12, (easyMid / pace - 0.55) / 1.15))
        out.push({ km, pace, level })
      }
  return out
}

export const kmOf = (w: Workout, s: PaceSettings) => w.done?.km ?? plannedKm(w, s)

export interface DayInfo {
  date: string
  items: Workout[]
  /** The run that defines the day, or its strength session when that is all there is. */
  main?: Workout
  km: number
  doneKm: number
  allDone: boolean
  isToday: boolean
}

export function useDay() {
  const workouts = useStore((s) => s.workouts)
  const settings = useStore((s) => s.settings)
  const now = today()
  return useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
    const start = mondayOf(now)
    const days: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      const items = sorted.filter((w) => w.date === date)
      return {
        date,
        items,
        main: items.find((w) => w.kind !== 'strength') ?? items[0],
        km: items.reduce((sum, w) => sum + kmOf(w, settings), 0),
        doneKm: items.reduce((sum, w) => sum + (w.done?.km ?? 0), 0),
        // A day counts as done once its runs are; a strength session left unticked doesn't hold it back.
        allDone: items.length > 0 && (items.some((w) => w.kind !== 'strength') ? items.filter((w) => w.kind !== 'strength') : items).every((w) => w.done),
        isToday: date === now,
      }
    })
    // Every week of the plan, first workout to last, for the "where am I in all this" views.
    const weeks: { start: string; km: number }[] = []
    if (sorted.length) {
      const last = mondayOf(sorted[sorted.length - 1].date)
      for (let m = mondayOf(sorted[0].date); m <= last; m = addDays(m, 7)) {
        const end = addDays(m, 6)
        weeks.push({ start: m, km: sorted.reduce((sum, w) => (w.date >= m && w.date <= end ? sum + kmOf(w, settings) : sum), 0) })
      }
    }
    return {
      now,
      settings,
      days,
      todays: days.find((d) => d.isToday)!.items,
      next: sorted.filter((w) => w.date > now && !w.done).slice(0, 3),
      weekPlanned: days.reduce((sum, d) => sum + d.km, 0),
      weekDone: days.reduce((sum, d) => sum + d.doneKm, 0),
      weeks,
      /** 1-based; 0 when today is outside the plan. */
      weekNo: weeks.findIndex((w) => w.start === start) + 1,
      hasPlan: workouts.length > 0,
    }
  }, [workouts, settings, now])
}
