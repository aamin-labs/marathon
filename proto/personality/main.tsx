// Throwaway prototype harness: four takes on the app's personality behind a picker. Nothing in src/ imports from this folder.
import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createJSONStorage } from 'zustand/middleware'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './snapshot/src/ui.css'
import './picker.css'
import './proto.css'
import { App } from './snapshot/src/App'
import { addDays, fromIso, iso, mondayOf } from './snapshot/src/lib/dates'
import { plannedKm, useStore, type Workout } from './snapshot/src/lib/store'
import { Bib } from './Bib'
import { Course } from './Course'
import { effort } from './data'
import { Notebook } from './Notebook'
import { Shell } from './Shell'

// A sandbox: the prototype starts from the app's saved data but never writes back, so nothing done here touches the real plan.
useStore.persist.setOptions({
  storage: createJSONStorage(() => ({ getItem: (k) => localStorage.getItem(k), setItem: () => {}, removeItem: () => {} })),
})
const pristine = useStore.getState().workouts

// "Which day is it" is a control, so every variant can be seen on a hard day, a rest day and race day.
// The whole page is told a different date: `new Date()` and `Date.now()` are shifted by a whole number of days.
const RealDate = Date
let offsetMs = 0
class ProtoDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(RealDate.now() + offsetMs)
    else super(...(args as [number]))
  }
  static now() {
    return RealDate.now() + offsetMs
  }
}
globalThis.Date = ProtoDate as DateConstructor

const DAYS = [
  { id: 'real', label: 'Real today' },
  { id: 'big', label: 'Longest workout' },
  { id: 'double', label: 'Run + strength' },
  { id: 'done', label: 'Run just done' },
  { id: 'rest', label: 'Rest day' },
  { id: 'race', label: 'Race day' },
] as const
type DayId = (typeof DAYS)[number]['id']

function setDay(id: DayId) {
  const real = iso(new RealDate())
  const { settings } = useStore.getState()
  const on = (date: string) => pristine.filter((w) => w.date === date)
  const ahead = Array.from({ length: 200 }, (_, i) => addDays(real, i))
  // Written-out length, repeats included: the workout with the most to show.
  const rows = (w: Workout) => w.blocks.reduce((n, b) => n + b.reps * b.steps.length, 0)
  let target = real
  if (id === 'big') target = [...pristine].filter((w) => w.kind === 'quality').sort((a, b) => rows(b) - rows(a))[0]?.date ?? real
  if (id === 'double') target = ahead.find((d) => on(d).length > 1) ?? real
  if (id === 'done') target = ahead.find((d) => on(d).some((w) => w.kind !== 'strength' && w.kind !== 'race')) ?? real
  if (id === 'rest') target = ahead.find((d) => on(d).length === 0) ?? real
  if (id === 'race') target = pristine.filter((w) => w.kind === 'race').sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? settings.raceDate

  const n = new RealDate()
  const t = fromIso(target)
  offsetMs = new RealDate(t.getFullYear(), t.getMonth(), t.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()).getTime() - n.getTime()

  // On a pretend day, the runs earlier in that week are filled in as done at their planned distance, so the week has progress to show.
  const start = mondayOf(target)
  const pretendDone = (w: Workout): Workout => {
    const steps = effort(w, settings)
    const km = Math.round(plannedKm(w, settings) * 10) / 10
    return { ...w, done: { km, sec: Math.round(steps.reduce((sum, s) => sum + s.km * s.pace, 0)) } }
  }
  useStore.setState({
    workouts:
      id === 'real'
        ? pristine
        : pristine.map((w) => (!w.done && w.kind !== 'strength' && w.date >= start && (w.date < target || (id === 'done' && w.date === target)) ? pretendDone(w) : w)),
  })
}

const VARIANTS = [
  { id: 'current', name: 'Current', render: () => <App /> },
  { id: 'notebook', name: 'Notebook', render: () => <Shell Today={Notebook} /> },
  { id: 'bib', name: 'Bib', render: () => <Shell Today={Bib} daysLabel /> },
  { id: 'course', name: 'Course', render: () => <Shell Today={Course} /> },
]

const params = new URLSearchParams(location.search)
const startV = Math.min(VARIANTS.length - 1, Math.max(0, (parseInt(params.get('v') ?? '', 10) || 1) - 1))
const startD = DAYS.find((d) => d.id === params.get('d'))?.id ?? 'real'
setDay(startD)
document.documentElement.dataset.proto = VARIANTS[startV].id

function Harness() {
  const [v, setV] = useState(startV)
  const [d, setD] = useState<DayId>(startD)
  const [run, setRun] = useState(0)
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 899px)').matches)
  const picker = useRef<HTMLElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  const remember = (key: string, value: string) => {
    const url = new URL(location.href)
    url.searchParams.set(key, value)
    history.replaceState(null, '', url)
  }
  const pick = (i: number) => {
    if (i < 0 || i >= VARIANTS.length) return
    document.documentElement.dataset.proto = VARIANTS[i].id
    remember('v', String(i + 1))
    setV(i)
    setRun((r) => r + 1)
  }
  const pickDay = (id: DayId) => {
    setDay(id)
    remember('d', id)
    setD(id)
    setRun((r) => r + 1)
  }

  useLayoutEffect(() => {
    const move = () => {
      const el = items.current[v]
      if (!el || !highlight.current) return
      highlight.current.style.width = `${el.offsetWidth}px`
      highlight.current.style.transform = `translateX(${el.offsetLeft}px)`
    }
    move()
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [v])

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => picker.current?.setAttribute('data-ready', '')))
    const mq = matchMedia('(max-width: 899px)')
    const onMq = () => setNarrow(mq.matches)
    mq.addEventListener('change', onMq)
    return () => mq.removeEventListener('change', onMq)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= VARIANTS.length) pick(num - 1)
      else if (e.key === 'ArrowRight') pick((v + 1) % VARIANTS.length)
      else if (e.key === 'ArrowLeft') pick((v - 1 + VARIANTS.length) % VARIANTS.length)
      else if (e.key === 'r' || e.key === 'R') setRun((r) => r + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [v])

  return (
    <>
      <div key={`${v}-${d}-${run}`}>{VARIANTS[v].render()}</div>
      <label className="proto-day">
        Day
        <select value={d} onChange={(e) => pickDay(e.target.value as DayId)}>
          {DAYS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      {/* On a phone the app's own tab bar is at the bottom, so the picker moves to the top. */}
      <nav ref={picker} className="proto-picker" aria-label="Prototype variants" data-position={narrow ? 'top' : undefined}>
        <span ref={highlight} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              items.current[i] = el
            }}
            className="proto-picker-item"
            data-active={i === v ? '' : undefined}
            aria-current={i === v ? 'true' : undefined}
            onClick={() => pick(i)}
          >
            {x.name}
          </button>
        ))}
      </nav>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
