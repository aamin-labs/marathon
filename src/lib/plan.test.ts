import { describe, expect, it } from 'vitest'
import { parseItem } from './parse'
import { calendarWeeks, currentWeekKm } from './plan'
import type { Workout } from './store'

const S = { goalTime: '3:30:00', easyLo: 70, easyHi: 80 }

/** A workout on a day, from its text. `done` is the result when it has been marked Done. */
const workout = (text: string, date: string, done?: Workout['done']): Workout => ({ ...parseItem(text)!, id: `${text} on ${date}`, date, done })

describe("the calendar's weeks", () => {
  // Saturday 14 November 2026. Its week starts on Monday the 9th.
  const now = '2026-11-14'

  it('run from the earliest workout’s week to the latest, numbered from 1, each with its seven days and the workouts on them', () => {
    const weeks = calendarWeeks(
      [
        workout('Race 42.195k', '2026-11-29'),
        workout('Easy 8k', '2026-11-03'),
        workout('Long 20k', '2026-11-08'),
        workout('Easy 10k', '2026-11-10'),
        workout('Strength A', '2026-11-10'),
      ],
      now,
      S,
    )
    expect(weeks.map((w) => [w.number, w.monday])).toEqual([
      [1, '2026-11-02'],
      [2, '2026-11-09'],
      [3, '2026-11-16'],
      [4, '2026-11-23'],
    ])
    const written = (week: number) => weeks[week - 1].days.map((d) => d.workouts.map((w) => w.src))
    expect(weeks[0].days.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
    expect(written(1)).toEqual([[], ['Easy 8k'], [], [], [], [], ['Long 20k']])
    // Several workouts on one day stay in the order they were given.
    expect(written(2)).toEqual([[], ['Easy 10k', 'Strength A'], [], [], [], [], []])
    // A week with nothing in it is still a week.
    expect(written(3)).toEqual([[], [], [], [], [], [], []])
    expect(written(4)).toEqual([[], [], [], [], [], [], ['Race 42.195k']])
  })

  it('are one week, the current one, when the calendar is empty', () => {
    const weeks = calendarWeeks([], now, S)
    expect(weeks).toHaveLength(1)
    expect(weeks[0]).toMatchObject({ number: 1, monday: '2026-11-09' })
    expect(weeks[0].days.map((d) => d.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect(weeks[0].days.every((d) => d.workouts.length === 0)).toBe(true)
  })

  it('each add up the distance that counts: Done distance for Done workouts, planned distance for the rest', () => {
    const weeks = calendarWeeks(
      [
        workout('Easy 8k', '2026-11-03', { km: 8.3, sec: 2900 }),
        // Cut short: what was run counts, not the 20 km planned.
        workout('Long 20k', '2026-11-08', { km: 14, sec: 5000 }),
        workout('Easy 10k', '2026-11-04'),
        // A strength session adds no distance, Done or not.
        workout('Strength A', '2026-11-04', { km: 0, sec: 0 }),
        workout('Easy 12k', '2026-11-10'),
        workout('Long 24k', '2026-11-15'),
      ],
      now,
      S,
    )
    expect(weeks[0].km).toBeCloseTo(32.3)
    expect(weeks[1].km).toBeCloseTo(36)
  })

  // A known quirk, kept on purpose: week numbers are counted from the earliest workout, so one added before the plan starts renumbers every week.
  // Putting it right needs the plan's start to be remembered, which is #4's question. Expect this test to change when #4 is built.
  it('are all renumbered by a workout added in the week before the plan starts', () => {
    const plan = [workout('Easy 8k', '2026-11-10'), workout('Long 20k', '2026-11-22')]
    expect(calendarWeeks(plan, now, S).map((w) => [w.number, w.monday])).toEqual([
      [1, '2026-11-09'],
      [2, '2026-11-16'],
    ])
    const withEarlyRun = [...plan, workout('Easy 5k', '2026-11-07')]
    expect(calendarWeeks(withEarlyRun, now, S).map((w) => [w.number, w.monday])).toEqual([
      [1, '2026-11-02'],
      [2, '2026-11-09'],
      [3, '2026-11-16'],
    ])
  })

  it('give the current week’s figures: the distance it is heading for, and the distance Done', () => {
    const workouts = [
      workout('Long 20k', '2026-11-08', { km: 20, sec: 7200 }), // last week
      workout('Easy 8k', '2026-11-09', { km: 8.3, sec: 2900 }),
      workout('Strength A', '2026-11-10', { km: 0, sec: 0 }),
      workout('Easy 10k', '2026-11-11', { km: 9.5, sec: 3400 }),
      workout('Easy 6k', '2026-11-14'),
      workout('Long 24k', '2026-11-15'),
      workout('Easy 8k', '2026-11-16'), // next week
    ]
    const figures = currentWeekKm(workouts, now, S)
    expect(figures.headingFor).toBeCloseTo(47.8)
    expect(figures.done).toBeCloseTo(17.8)
    // The same week as the calendar shows, so the two pages agree.
    expect(figures.headingFor).toBe(calendarWeeks(workouts, now, S)[1].km)
  })

  it('give no distance for the current week when it has no workouts, or lies outside the calendar', () => {
    expect(currentWeekKm([], now, S)).toEqual({ headingFor: 0, done: 0 })
    const lastMonth = [workout('Easy 8k', '2026-10-06', { km: 8, sec: 2800 }), workout('Long 20k', '2026-10-11')]
    expect(currentWeekKm(lastMonth, now, S)).toEqual({ headingFor: 0, done: 0 })
  })
})
