import { useState } from 'react'
import { parseNumber } from './lib/number'
import { fmtKm } from './lib/pace'
import { shoeKm, useStore } from './lib/store'
import { withUndo } from './lib/undo'

export function Shoes() {
  const shoes = useStore((s) => s.shoes)
  const workouts = useStore((s) => s.workouts)
  const retireKm = useStore((s) => s.settings.retireKm)
  const addShoe = useStore((s) => s.addShoe)
  const updateShoe = useStore((s) => s.updateShoe)
  const removeShoe = useStore((s) => s.removeShoe)
  const [name, setName] = useState('')
  const [start, setStart] = useState('')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addShoe(name.trim(), parseNumber(start, { min: 0 }) ?? 0)
    setName('')
    setStart('')
  }

  const sorted = [...shoes].sort((a, b) => Number(a.retired) - Number(b.retired))

  return (
    <>
      <header className="head">
        <h1>Shoes</h1>
        <p className="muted">Pick a pair when you log a run and its distance is added here.</p>
      </header>

      <div className="card-grid">
        {shoes.length === 0 && (
          <section className="card">
            <h2>No shoes yet</h2>
            <p className="muted">Add the pairs you run in, with the distance they have already covered. Each gets a running total and a warning when it is time to replace it.</p>
          </section>
        )}

        {sorted.map((shoe) => {
          const km = shoeKm(shoe, workouts)
          const used = workouts.some((w) => w.done?.shoeId === shoe.id)
          return (
            <section key={shoe.id} className={`card shoe${shoe.retired ? ' retired' : ''}`}>
              <div className="today-top">
                <h2>{shoe.name}</h2>
                <span className="big-num">
                  {fmtKm(km)}
                  <small> km</small>
                </span>
              </div>
              <div className={`meter${km >= retireKm ? ' full' : ''}`} role="img" aria-label={`${fmtKm(km)} of ${retireKm} km`}>
                <i style={{ transform: `translateX(${Math.min(100, (km / retireKm) * 100) - 100}%)` }} />
              </div>
              <p className="muted">{shoe.retired ? 'Retired' : km >= retireKm ? `Past ${retireKm} km: time to replace them` : `${fmtKm(retireKm - km)} km until ${retireKm} km`}</p>
              <div className="btn-row">
                <button className="btn" onClick={() => updateShoe(shoe.id, { retired: !shoe.retired })}>
                  {shoe.retired ? 'Bring back' : 'Retire'}
                </button>
                {/* Removing a pair that has runs logged would lose which shoe those runs used. */}
                {!used && (
                  <button className="btn danger" onClick={() => withUndo(`${shoe.name} removed`, () => removeShoe(shoe.id))}>
                    Remove
                  </button>
                )}
              </div>
            </section>
          )
        })}

        <form className="card" onSubmit={add}>
          <h2>Add a pair</h2>
          <div className="fields">
            <label className="wide">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novablast 5, blue" />
            </label>
            <label>
              Distance so far, km
              <input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" />
            </label>
          </div>
          <button className="btn primary" disabled={!name.trim()}>
            Add shoes
          </button>
        </form>
      </div>
    </>
  )
}
