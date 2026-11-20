// Throwaway prototype code. The app's shell, copied from src/App.tsx so each variant can swap the Today page and the sidebar's two ends.
// The other three sections and the workout sheet are the real ones: a variant's colours and type carry into them, so they can be judged there too.
import { CalendarDays, Footprints, SlidersHorizontal, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { daysBetween, fmtDate, today } from './snapshot/src/lib/dates'
import { useStore } from './snapshot/src/lib/store'
import { Plan } from './snapshot/src/Plan'
import { Setup } from './snapshot/src/Setup'
import { Sheet } from './snapshot/src/Sheet'
import { Shoes } from './snapshot/src/Shoes'

const TABS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'plan', label: 'Plan', icon: CalendarDays },
  { id: 'shoes', label: 'Shoes', icon: Footprints },
  { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
] as const

type Tab = (typeof TABS)[number]['id']

export interface TodayProps {
  onOpen: (id: string) => void
  onSetup: () => void
}

function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M8 22V10l8 8 8-8v12" fill="none" stroke="var(--on-accent)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Shell({ Today, daysLabel }: { Today: (p: TodayProps) => ReactNode; daysLabel?: boolean }) {
  const [tab, setTab] = useState<Tab>('today')
  const [open, setOpen] = useState<{ id: string; edit: boolean } | null>(null)
  const openSheet = (id: string, edit = false) => setOpen({ id, edit })
  const name = useStore((s) => s.settings.raceName)
  const date = useStore((s) => s.settings.raceDate)
  const days = daysBetween(today(), date)
  const go = (t: Tab) => {
    setTab(t)
    window.scrollTo(0, 0)
  }

  return (
    <div className="shell">
      <nav className="nav" aria-label="Sections">
        <div className="brand">
          <Mark />
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
        <div className="race">
          {/* `daysLabel` splits the number from its unit so a variant can set the number large. */}
          {daysLabel && days > 0 ? (
            <span className="race-days">
              <b>{days}</b> {days === 1 ? 'day to go' : 'days to go'}
            </span>
          ) : (
            <span className="race-days">{days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'Race day' : 'Done'}</span>
          )}
          <span className="race-name">{name}</span>
          <span className="muted">{fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </nav>
      <main className="page">
        {tab === 'today' && <Today onOpen={openSheet} onSetup={() => go('setup')} />}
        {tab === 'plan' && <Plan onOpen={openSheet} />}
        {tab === 'shoes' && <Shoes />}
        {tab === 'setup' && <Setup />}
      </main>
      {open && <Sheet id={open.id} startEditing={open.edit} onClose={() => setOpen(null)} />}
    </div>
  )
}
