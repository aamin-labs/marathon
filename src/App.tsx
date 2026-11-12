import { useState } from 'react'
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

export function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="page">
        {tab === 'today' && <Today onOpen={setOpenId} />}
        {tab === 'plan' && <Plan onOpen={setOpenId} />}
        {tab === 'shoes' && <Shoes />}
        {tab === 'setup' && <Setup />}
      </main>
      {openId && <Sheet id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
