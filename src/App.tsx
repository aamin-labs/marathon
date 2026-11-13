import { useEffect, useState } from 'react'
import { dismissUndo, undo, useUndo } from './lib/undo'
import { Plan } from './Plan'
import { Setup } from './Setup'
import { Sheet } from './Sheet'
import { Shoes } from './Shoes'
import { Today } from './Today'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'setup', label: 'Setup' },
] as const

type Tab = (typeof TABS)[number]['id']

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
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
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

export function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [openId, setOpenId] = useState<string | null>(null)

  // Every section shares the one page scroll, so start each at its top rather than wherever the last one was left.
  const go = (t: Tab) => {
    setTab(t)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="page">
        {tab === 'today' && <Today onOpen={setOpenId} onSetup={() => go('setup')} />}
        {tab === 'plan' && <Plan onOpen={setOpenId} />}
        {tab === 'shoes' && <Shoes />}
        {tab === 'setup' && <Setup />}
      </main>
      {openId && <Sheet id={openId} onClose={() => setOpenId(null)} />}
      <UndoToast />
    </>
  )
}
