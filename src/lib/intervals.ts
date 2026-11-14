import { slowdown } from './conditions'
import { addDays, today } from './dates'
import { fmtClock, targetPaces, type PaceSettings } from './pace'
import type { Step } from './parse'
import { plannedKm, useStore, type Lap, type Workout } from './store'

// Sends planned runs to the intervals.icu calendar. From there the Intervals Companion
// iPhone app passes them to the Apple Watch. Completed runs are read back from the same place.

const ROOT = 'https://intervals.icu/api/v1'
const API = `${ROOT}/athlete/0` // 0 = "the athlete this key belongs to"
export const DAYS_AHEAD = 7
export const DAYS_BACK = 28

// intervals.icu reads "m" as minutes, so metres must be written "mtr".
function icuStep(step: Step, s: PaceSettings, heatPct: number): string {
  let size: string
  if (step.km != null) size = step.km < 1 ? `${Math.round(step.km * 1000)}mtr` : `${step.km}km`
  else {
    const sec = step.sec ?? 0
    size = `${sec >= 60 ? `${Math.floor(sec / 60)}m` : ''}${sec % 60 ? `${sec % 60}s` : ''}`
  }
  // Paces go out as absolute min/km: intervals.icu's own percentages are of threshold pace, not marathon pace.
  const paces = targetPaces(step.target, s, heatPct)
  if (!paces) return `- ${size}`
  const [fast, slow] = paces.map((p) => `${fmtClock(p)}/km`)
  return `- ${size} ${fast === slow ? fast : `${fast}-${slow}`} Pace`
}

/** The workout in intervals.icu's text format, with heat-adjusted paces when conditions are set. */
export function icuDescription(w: Workout, s: PaceSettings): string {
  const heat = slowdown(w)
  // Repeat blocks need a blank line either side.
  return w.blocks
    .map((b) => {
      const steps = b.steps.map((step) => icuStep(step, s, heat)).join('\n')
      return b.reps > 1 ? `\n${b.reps}x\n${steps}\n` : steps
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function call(key: string, path: string, init: RequestInit = {}, base = API): Promise<Response> {
  let res: Response
  try {
    res = await fetch(base + path, {
      ...init,
      headers: { Authorization: `Basic ${btoa(`API_KEY:${key}`)}`, 'Content-Type': 'application/json' },
    })
  } catch {
    throw new Error("Couldn’t reach intervals.icu. Check your connection and try again.")
  }
  if (res.status === 401 || res.status === 403) throw new Error('intervals.icu rejected the API key. Check it in Setup.')
  return res
}

/** Send upcoming runs, and remove ones that were deleted here. Returns a message for the user. */
export async function sendToIntervals(): Promise<string> {
  const { icuKey, workouts, settings, pushed } = useStore.getState()
  if (!icuKey.trim()) throw new Error('Add your intervals.icu API key in Setup first.')
  const key = icuKey.trim()
  const from = today()
  const to = addDays(from, DAYS_AHEAD - 1)

  // Upcoming runs, plus any sent before that have since moved outside the window, so their date updates too.
  const runs = workouts.filter((w) => w.kind !== 'strength' && !w.done && ((w.date >= from && w.date <= to) || w.id in pushed))
  const next: Record<string, number> = {}

  if (runs.length) {
    const body = runs.map((w) => ({
      category: 'WORKOUT',
      type: 'Run',
      start_date_local: `${w.date}T00:00:00`,
      name: w.title,
      description: icuDescription(w, settings),
      external_id: w.id, // lets a re-send update the same calendar entry instead of adding a copy
    }))
    const res = await call(key, '/events/bulk?upsert=true', { method: 'POST', body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`intervals.icu couldn’t save the workouts (error ${res.status}). ${(await res.text()).slice(0, 200)}`)
    const saved: unknown = await res.json().catch(() => null)
    if (Array.isArray(saved)) for (const e of saved) if (e?.external_id && typeof e.id === 'number') next[e.external_id] = e.id
  }

  // Workouts removed here (or replaced by a rebuilt schedule) are removed there too. Logged ones stay as history.
  let removed = 0
  const stillHere = new Set(workouts.map((w) => w.id))
  for (const [id, eventId] of Object.entries(pushed)) {
    if (stillHere.has(id)) {
      if (!(id in next)) next[id] = eventId
      continue
    }
    const res = await call(key, `/events/${eventId}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) removed++
    else next[id] = eventId // keep it so the next send tries again
  }

  useStore.setState({ pushed: next })
  const sent = `Sent ${runs.length} ${runs.length === 1 ? 'run' : 'runs'} to intervals.icu`
  return removed ? `${sent} and removed ${removed}.` : `${sent}.`
}

/** Take every run this app sent back out of the intervals.icu calendar. */
export async function removeSent(): Promise<string> {
  const { icuKey, pushed } = useStore.getState()
  if (!icuKey.trim()) throw new Error('Add your intervals.icu API key in Setup first.')
  const left: Record<string, number> = {}
  let removed = 0
  for (const [id, eventId] of Object.entries(pushed)) {
    const res = await call(icuKey.trim(), `/events/${eventId}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) removed++
    else left[id] = eventId
  }
  useStore.setState({ pushed: left })
  const failed = Object.keys(left).length
  if (failed) throw new Error(`Removed ${removed}, but ${failed} couldn’t be removed. Try again, or delete them in the intervals.icu calendar.`)
  return removed ? `Removed ${removed} ${removed === 1 ? 'run' : 'runs'} from intervals.icu.` : 'Nothing to remove: no runs from this app are in intervals.icu.'
}

/** The parts of an intervals.icu activity this app reads. Activities that came from Strava arrive as stubs with no details. */
export interface IcuActivity {
  id: string
  start_date_local?: string
  type?: string
  distance?: number // metres
  moving_time?: number // seconds
  source?: string
}

/** Pair each planned run with the activities recorded on its day: planned workout id → activities. */
export function matchRuns(planned: { id: string; date: string; km: number }[], runs: IcuActivity[]): Map<string, IcuActivity[]> {
  const out = new Map<string, IcuActivity[]>()
  for (const date of new Set(planned.map((p) => p.date))) {
    const plans = planned.filter((p) => p.date === date).sort((a, b) => b.km - a.km)
    const acts = runs.filter((a) => a.start_date_local?.slice(0, 10) === date).sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))
    if (!acts.length) continue
    // One planned run: everything recorded that day is part of it, e.g. a warm-up saved as its own activity.
    if (plans.length === 1) out.set(plans[0].id, acts)
    // Several planned runs: longest recording goes to the longest plan, and so on down.
    else plans.forEach((p, i) => acts[i] && out.set(p.id, [acts[i]]))
  }
  return out
}

async function fetchLaps(key: string, activityId: string): Promise<Lap[] | undefined> {
  try {
    const res = await call(key, `/activity/${activityId}/intervals`, {}, ROOT)
    if (!res.ok) return undefined
    const data: { icu_intervals?: { type?: string; distance?: number; moving_time?: number; elapsed_time?: number }[] } = await res.json()
    const laps = (data.icu_intervals ?? [])
      .map((i) => ({ km: (i.distance ?? 0) / 1000, sec: i.moving_time ?? i.elapsed_time ?? 0, work: i.type === 'WORK' }))
      .filter((l) => l.km > 0 && l.sec > 0)
    return laps.length ? laps : undefined
  } catch {
    return undefined // the run is still logged, just without its laps
  }
}

/** Log runs recorded in intervals.icu against the planned workouts on the same days. Returns a message for the user. */
export async function fetchCompleted(): Promise<string> {
  const { icuKey, workouts, settings, shoes, updateWorkout } = useStore.getState()
  if (!icuKey.trim()) throw new Error('Add your intervals.icu API key in Setup first.')
  const key = icuKey.trim()
  const to = today()
  const from = addDays(to, -(DAYS_BACK - 1))

  const open = workouts.filter((w) => w.kind !== 'strength' && !w.done && w.date >= from && w.date <= to)
  if (!open.length) return `Nothing to fetch: every run planned in the last ${DAYS_BACK} days is already logged.`

  const res = await call(key, `/activities?oldest=${from}&newest=${to}T23:59:59`)
  if (!res.ok) throw new Error(`intervals.icu couldn’t list your activities (error ${res.status}).`)
  const all: IcuActivity[] = await res.json()
  const runs = all.filter((a) => /run/i.test(a.type ?? '') && (a.distance ?? 0) > 0)
  const fromStrava = all.filter((a) => a.source === 'STRAVA' && !a.distance).length

  // Same default as the log form: the pair worn on the most recent logged run.
  const lastShoe = [...workouts].filter((w) => w.done?.shoeId).sort((a, b) => b.date.localeCompare(a.date))[0]?.done?.shoeId
  const shoeId = shoes.some((s) => s.id === lastShoe && !s.retired) ? lastShoe : undefined

  const matched = matchRuns(open.map((w) => ({ id: w.id, date: w.date, km: plannedKm(w, settings) })), runs)
  for (const [id, acts] of matched) {
    const w = open.find((x) => x.id === id)!
    // Laps only matter for sessions with more than one step, and come from the main recording.
    const structured = w.blocks.length > 1 || w.blocks.some((b) => b.reps > 1)
    updateWorkout(id, {
      done: {
        km: Math.round(acts.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 10) / 100,
        sec: acts.reduce((sum, a) => sum + (a.moving_time ?? 0), 0),
        shoeId,
        laps: structured ? await fetchLaps(key, acts[0].id) : undefined,
      },
    })
  }

  const logged = matched.size ? `Logged ${matched.size} ${matched.size === 1 ? 'run' : 'runs'} from intervals.icu.` : `No new runs found in intervals.icu for the last ${DAYS_BACK} days.`
  const hidden = fromStrava
    ? ` ${fromStrava} ${fromStrava === 1 ? 'activity reached' : 'activities reached'} intervals.icu through Strava, which doesn’t let other apps read them. Log those by hand.`
    : ''
  return logged + hidden
}
