import { CalendarDays, Footprints, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { daysBetween, fmtDate, today } from './lib/dates'
import { useStore } from './lib/store'
import { dismissUndo, undo, useUndo } from './lib/undo'
import { Plan } from './Plan'
import { Setup } from './Setup'
import { Sheet } from './Sheet'
import { Shoes } from './Shoes'
import { Today } from './Today'

const TABS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'plan', label: 'Plan', icon: CalendarDays },
  { id: 'shoes', label: 'Shoes', icon: Footprints },
  { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
] as const

type Tab = (typeof TABS)[number]['id']

// The open section is remembered for this browser tab, so a refresh comes back to it instead of dropping to Today.
// Storage can be switched off (private windows, blocked site data), so both ends are guarded: the app works without it.
const TAB_KEY = 'marathon-tab'
function savedTab(): Tab {
  try {
    const saved = sessionStorage.getItem(TAB_KEY)
    return TABS.find((t) => t.id === saved)?.id ?? 'today'
  } catch {
    return 'today'
  }
}

/** Says what was just removed or replaced and offers to put it back. Goes away on its own after a while. */
function UndoToast() {
  const pending = useUndo((s) => s.pending)
  // The countdown waits while the pointer or keyboard focus is on the message, so it can't vanish as you reach for it.
  const [held, setHeld] = useState(false)
  if (!pending && held) setHeld(false)
  // Keeps the last message on screen while it plays its exit, after the offer itself is gone.
  const [shown, setShown] = useState(pending)
  if (pending && pending !== shown) setShown(pending)
  const leaving = !pending

  useEffect(() => {
    if (!pending || held) return
    const timer = setTimeout(dismissUndo, 10_000)
    return () => clearTimeout(timer)
  }, [pending, held])

  // The status region is always on the page and only its contents come and go: screen readers announce changes inside a region they already know.
  return (
    <div role="status">
      {shown && (
        <div
          className={`toast${leaving ? ' leaving' : ''}`}
          inert={leaving}
          onAnimationEnd={() => leaving && setShown(null)}
          // Mouse only: a finger tap also counts as "entering" but never leaves, which would hold the message forever.
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span>{shown.label}</span>
          <button
            className="btn"
            onClick={() => {
              setHeld(false)
              undo()
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

/** The race and how far off it is. Shown at the foot of the sidebar, so laptop-sized screens only. */
function Race() {
  const name = useStore((s) => s.settings.raceName)
  const date = useStore((s) => s.settings.raceDate)
  const days = daysBetween(today(), date)
  return (
    <div className="race">
      <span className="race-days">{days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'Race day' : 'Done'}</span>
      <span className="race-name">{name}</span>
      <span className="muted">{fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </div>
  )
}

export function App() {
  // Read before the first render, so the page never shows Today for a moment and then switches.
  const [tab, setTab] = useState<Tab>(savedTab)
  // `edit` opens the sheet ready to change the workout: used for one that was just added.
  const [open, setOpen] = useState<{ id: string; edit: boolean } | null>(null)
  const openSheet = (id: string, edit = false) => setOpen({ id, edit })

  // Every section shares the one page scroll, so start each at its top rather than wherever the last one was left.
  const go = (t: Tab) => {
    setTab(t)
    try {
      sessionStorage.setItem(TAB_KEY, t)
    } catch {}
    window.scrollTo(0, 0)
  }

  return (
    <div className="shell">
      <nav className="nav" aria-label="Sections">
        <div className="brand">
          <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <path d="M8 22V10l8 8 8-8v12" fill="none" stroke="var(--on-accent)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          Marathon
        </div>
        <div className="nav-items">
          {TABS.map((t) => (
            <button key={t.id} className="nav-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <t.icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
        <Race />
      </nav>
      <main className="page">
        {tab === 'today' && <Today onOpen={openSheet} onSetup={() => go('setup')} />}
        {tab === 'plan' && <Plan onOpen={openSheet} />}
        {tab === 'shoes' && <Shoes />}
        {tab === 'setup' && <Setup />}
      </main>
      {open && <Sheet id={open.id} startEditing={open.edit} onClose={() => setOpen(null)} />}
      <UndoToast />
    </div>
  )
}
