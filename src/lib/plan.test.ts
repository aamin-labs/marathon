import { describe, expect, it } from 'vitest'
import { addDays, mondayOf } from './dates'
import { parseItem } from './parse'
import { calendarWeeks, currentWeekKm, layPlan } from './plan'
import { samplePlan } from './samplePlan'
import type { Workout } from './store'
import { plannedKm } from './workout'
import breeze80 from '../../marathon-plans/breeze-80.txt?raw'

/** Lay a plan that is expected to have no mistakes, and give back what was laid. */
function laid(planText: string, raceDay: string, existing: Workout[] = []) {
  const result = layPlan(planText, raceDay, existing)
  if ('errors' in result) throw new Error(`The plan has mistakes: ${result.errors.map((e) => e.msg).join(' ')}`)
  return result
}

/** What the tests look at: the day, kind and title of each workout, in calendar order. Never the identities, which are random. */
const onCalendar = (workouts: Workout[]) => workouts.map((w) => `${w.date} ${w.kind} ${w.title}`).sort()

describe('laying a plan onto the calendar', () => {
  it('puts the last written week on race day’s week, and week 1 on the Monday that many weeks before', () => {
    // 10 March 2027 is a Wednesday: its week runs Monday 8 to Sunday 14 March.
    const { workouts } = laid('Week 1\nMon: Easy 8k\nWeek 2\nThu: Easy 10k\nSun: Long 20k', '2027-03-10')
    expect(onCalendar(workouts)).toEqual(['2027-03-01 easy Easy run', '2027-03-11 easy Easy run', '2027-03-14 long Long run'])
  })

  it('lays joined workouts as several on one day', () => {
    const { workouts } = laid('Week 1\nTue: Easy 10k + Strength A', '2027-03-14')
    expect(onCalendar(workouts)).toEqual(['2027-03-09 easy Easy run', '2027-03-09 strength Strength A'])
  })

  it('lays nothing on a rest day', () => {
    const { workouts } = laid('Week 1\nMon: Rest\nTue: Easy 10k\nWed: Rest', '2027-03-14')
    expect(onCalendar(workouts)).toEqual(['2027-03-09 easy Easy run'])
  })

  it('says how many weeks were written', () => {
    expect(laid('Week 1\nMon: Easy 8k\nWeek 2\nMon: Rest\nWeek 3\nSun: Long 20k', '2027-03-14').weeks).toBe(3)
  })

  it('lays the sample plan out to finish on race day', () => {
    const { workouts, weeks } = laid(samplePlan(), '2027-03-14')
    expect(weeks).toBe(18)
    const race = workouts.find((w) => w.kind === 'race')!
    expect(race.date).toBe('2027-03-14')
    const first = workouts.map((w) => w.date).sort()[0]
    expect(mondayOf(first)).toBe('2026-11-09') // 17 weeks before the Monday of race week, 8 March 2027
  })

  it('lays the Breeze 80 plan out and lands near the book weekly totals', () => {
    const { workouts, weeks } = laid(breeze80, '2027-03-14')
    expect(weeks).toBe(18)
    const s = { goalTime: '4:00:00', fiveK: '23:20', easyLo: 70, easyHi: 80 }
    // Weeks 15 to 17 are a 65–72 km range in the book; race week has no goal.
    const goals = [55, 61, 68, 58, 68, 74, 80, 68, 80, 80, 80, 68, 80, 80, 68.5, 68.5, 68.5]
    const race = workouts.find((w) => w.kind === 'race')!
    expect(race.date).toBe('2027-03-14')
    expect(plannedKm(race, s)).toBeCloseTo(42.195)
    const totals = goals.map((_, i) => {
      const monday = addDays('2026-11-09', i * 7)
      return workouts.filter((w) => mondayOf(w.date) === monday).reduce((sum, w) => sum + plannedKm(w, s), 0)
    })
    totals.forEach((km, i) => expect(Math.abs(km - goals[i]), `week ${i + 1}: ${km.toFixed(1)} km`).toBeLessThanOrEqual(4))
  })
})

describe('laying a plan onto a calendar that already has workouts', () => {
  const PLAN = 'Week 1\nTue: Easy 10k + Strength A\nSun: Long 20k'
  const RACE_DAY = '2027-03-14' // a Sunday, so the week is Monday 8 to Sunday 14 March
  const result = { km: 10.2, sec: 3300 }

  it('keeps Done workouts as they are', () => {
    const [easy] = laid(PLAN, RACE_DAY).workouts
    const done: Workout = { ...easy, title: 'Easy with Sam', done: result }
    // A Done workout from before the plan starts is history too.
    const earlier: Workout = { ...easy, id: 'earlier', date: '2026-12-25', done: result }
    const { workouts } = laid(PLAN, RACE_DAY, [done, earlier])
    expect(workouts).toContainEqual(done)
    expect(workouts).toContainEqual(earlier)
  })

  it('leaves out a written workout when a Done workout of the same kind is on that day, and keeps one of a different kind', () => {
    const [easy] = laid(PLAN, RACE_DAY).workouts
    const done: Workout = { ...easy, title: 'Easy with Sam', done: result }
    const { workouts } = laid(PLAN, RACE_DAY, [done])
    // Tuesday has the Done easy run once, not a second planned one, and strength is still planned beside it.
    expect(onCalendar(workouts)).toEqual(['2027-03-09 easy Easy with Sam', '2027-03-09 strength Strength A', '2027-03-14 long Long run'])
  })

  it('replaces every workout that is not Done, including moved and hand-added ones', () => {
    const [easy, strength, long] = laid(PLAN, RACE_DAY).workouts
    const moved: Workout = { ...long, date: '2027-03-13' } // the long run, moved to Saturday
    const added: Workout = { ...easy, id: 'added', title: 'Shakeout', date: '2027-03-11' } // put on Thursday by hand
    const { workouts } = laid(PLAN, RACE_DAY, [easy, strength, moved, added])
    expect(onCalendar(workouts)).toEqual(['2027-03-09 easy Easy run', '2027-03-09 strength Strength A', '2027-03-14 long Long run'])
  })

  it('changes nothing when the plan has a mistake: it gives back each mistake with its line number, and no workouts', () => {
    const [easy] = laid(PLAN, RACE_DAY).workouts
    const outcome = layPlan('Mon: Easy 5k\nWeek 1\nTue: Easy ten\nWed: Easy 8k', RACE_DAY, [{ ...easy, done: result }])
    expect(outcome).toEqual({
      errors: [
        { line: 1, msg: 'Start with a “Week 1” line before the first day.' },
        { line: 3, msg: 'Can’t read the step “ten”. Write a distance or time, then an optional pace, like 1k @95%.' },
      ],
    })
  })
})

const S ={ goalTime: '3:30:00', easyLo: 70, easyHi: 80 }

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
