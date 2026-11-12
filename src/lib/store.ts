import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, mondayOf, today } from './dates'
import { targetPaces, type PaceSettings } from './pace'
import { parsePlan, type Item, type PlanError } from './parse'
import { SAMPLE_ROUTINES, samplePlan } from './samplePlan'

export interface Settings extends PaceSettings {
  raceName: string
  raceDate: string
  lat: number | null
  lon: number | null
  runHour: number
  retireKm: number
}

/** One stretch of a completed run, as intervals.icu split it. `work` is false for recoveries. */
export interface Lap {
  km: number
  sec: number
  work: boolean
}

export interface Workout extends Item {
  id: string
  date: string
  done?: { km: number; sec: number; shoeId?: string; note?: string; laps?: Lap[] }
  heat?: { tempC: number; dewC: number }
}

export interface Shoe {
  id: string
  name: string
  startKm: number
  retired: boolean
}

export interface Routine {
  name: string
  text: string
}

interface Data {
  settings: Settings
  planText: string
  workouts: Workout[]
  shoes: Shoe[]
  routines: Routine[]
}

interface State extends Data {
  /** intervals.icu API key. Kept out of backups. */
  icuKey: string
  /** Workouts already sent to intervals.icu: our workout id → their calendar event id. */
  pushed: Record<string, number>
  setIcuKey: (key: string) => void
  setSettings: (patch: Partial<Settings>) => void
  setPlanText: (text: string) => void
  /** Rebuild the schedule from the plan text. Returns the plan's errors; empty means it worked. */
  applyPlan: () => PlanError[]
  addWorkout: (date: string, item: Item) => string
  updateWorkout: (id: string, patch: Partial<Workout>) => void
  removeWorkout: (id: string) => void
  addShoe: (name: string, startKm: number) => void
  updateShoe: (id: string, patch: Partial<Shoe>) => void
  removeShoe: (id: string) => void
  setRoutine: (name: string, text: string) => void
  replaceAll: (data: Data) => void
}

const uid = () => crypto.randomUUID()

/** Lay the plan's weeks onto the calendar so the last week contains race day. */
export function schedule(planText: string, raceDate: string): { workouts: Workout[]; errors: PlanError[] } {
  const { weeks, errors } = parsePlan(planText)
  const start = addDays(mondayOf(raceDate), -(weeks.length - 1) * 7)
  const workouts = weeks.flatMap((days, wi) =>
    days.flatMap((items, di) => items.map((item) => ({ ...item, id: uid(), date: addDays(start, wi * 7 + di) }))),
  )
  return { workouts, errors }
}

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

export function shoeKm(shoe: Shoe, workouts: Workout[]): number {
  return workouts.reduce((sum, w) => (w.done?.shoeId === shoe.id ? sum + w.done.km : sum), shoe.startKm)
}

function initial(): Data {
  // Default race day: the Sunday 18 weeks out, so the sample plan starts this week.
  const raceDate = addDays(mondayOf(today()), 17 * 7 + 6)
  const planText = samplePlan()
  return {
    settings: { raceName: 'My marathon', raceDate, goalTime: '3:30:00', fiveK: '', easyLo: 70, easyHi: 80, lat: null, lon: null, runHour: 7, retireKm: 700 },
    planText,
    workouts: schedule(planText, raceDate).workouts,
    shoes: [],
    routines: SAMPLE_ROUTINES,
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),
      icuKey: '',
      pushed: {},
      setIcuKey: (icuKey) => set({ icuKey }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setPlanText: (planText) => set({ planText }),
      applyPlan: () => {
        const { planText, settings, workouts } = get()
        const built = schedule(planText, settings.raceDate)
        if (built.errors.length) return built.errors
        // Completed workouts are history: keep them, and don't re-plan the same kind of session on that day.
        const done = workouts.filter((w) => w.done)
        const fresh = built.workouts.filter((w) => !done.some((d) => d.date === w.date && d.kind === w.kind))
        set({ workouts: [...done, ...fresh] })
        return []
      },
      addWorkout: (date, item) => {
        const id = uid()
        set((s) => ({ workouts: [...s.workouts, { ...item, id, date }] }))
        return id
      },
      updateWorkout: (id, patch) => set((s) => ({ workouts: s.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
      addShoe: (name, startKm) => set((s) => ({ shoes: [...s.shoes, { id: uid(), name, startKm, retired: false }] })),
      updateShoe: (id, patch) => set((s) => ({ shoes: s.shoes.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeShoe: (id) => set((s) => ({ shoes: s.shoes.filter((x) => x.id !== id) })),
      setRoutine: (name, text) => set((s) => ({ routines: s.routines.map((r) => (r.name === name ? { ...r, text } : r)) })),
      replaceAll: (data) => set(data),
    }),
    { name: 'marathon-v1' },
  ),
)

export function exportData(): Data {
  const { settings, planText, workouts, shoes, routines } = useStore.getState()
  return { settings, planText, workouts, shoes, routines }
}
