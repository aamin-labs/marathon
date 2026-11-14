import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, mondayOf, today } from './dates'
import type { PaceSettings } from './pace'
import type { Item } from './parse'
import { layPlan, type LaidPlan } from './plan'
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
  /** The conditions the paces are slowed for. `auto` marks a fetched forecast, which is refreshed; without it they were entered by hand and are kept. */
  heat?: { tempC: number; dewC: number; auto?: boolean }
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

export interface Data {
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
  /** Rebuild the schedule from the plan text. Returns what the Plan module laid, or the plan's errors with nothing changed. */
  applyPlan: () => LaidPlan
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

function initial(): Data {
  // Default race day: the Sunday 18 weeks out, so the sample plan starts this week.
  const raceDate = addDays(mondayOf(today()), 17 * 7 + 6)
  const planText = samplePlan()
  const laid = layPlan(planText, raceDate, [])
  return {
    settings: { raceName: 'My marathon', raceDate, goalTime: '3:30:00', fiveK: '', easyLo: 70, easyHi: 80, lat: null, lon: null, runHour: 7, retireKm: 700 },
    planText,
    workouts: 'workouts' in laid ? laid.workouts : [], // the sample plan has no mistakes, so there are always workouts
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
        const laid = layPlan(planText, settings.raceDate, workouts)
        if ('workouts' in laid) set({ workouts: laid.workouts })
        return laid
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
