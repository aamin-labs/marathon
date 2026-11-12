import { useEffect, useState } from 'react'
import { fmtDate } from './lib/dates'
import { fmtClock, fmtKm, parseClock, targetPaces, verdict } from './lib/pace'
import { parseItem, type Step } from './lib/parse'
import { plannedKm, useStore, type Lap, type Workout } from './lib/store'
import { fetchConditions } from './lib/weather'
import { heatOf, Steps } from './Steps'

function Heat({ w }: { w: Workout }) {
  const settings = useStore((s) => s.settings)
  const updateWorkout = useStore((s) => s.updateWorkout)
  const [temp, setTemp] = useState(w.heat ? String(w.heat.tempC) : '')
  const [dew, setDew] = useState(w.heat ? String(w.heat.dewC) : '')
  const [msg, setMsg] = useState('')
  const heat = heatOf(w)

  const apply = (t: string, d: string) => {
    setTemp(t)
    setDew(d)
    const ok = t.trim() !== '' && d.trim() !== '' && Number.isFinite(Number(t)) && Number.isFinite(Number(d))
    updateWorkout(w.id, { heat: ok ? { tempC: Number(t), dewC: Number(d) } : undefined })
  }

  const forecast = async () => {
    if (settings.lat == null || settings.lon == null) return setMsg('Set your location in Setup to get a forecast.')
    setMsg('Getting the forecast…')
    try {
      const c = await fetchConditions(settings.lat, settings.lon, w.date, settings.runHour)
      apply(String(c.tempC), String(c.dewC))
      setMsg(`Forecast for ${settings.runHour}:00`)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <section className="sheet-section">
      <h3>Heat</h3>
      <div className="fields">
        <label>
          Temperature °C
          <input inputMode="decimal" value={temp} onChange={(e) => apply(e.target.value, dew)} />
        </label>
        <label>
          Dew point °C
          <input inputMode="decimal" value={dew} onChange={(e) => apply(temp, e.target.value)} />
        </label>
        <button className="btn" onClick={forecast}>
          Use forecast
        </button>
      </div>
      <p className="muted" aria-live="polite">
        {w.heat ? (heat > 0 ? `Paces above are slowed ${heat.toFixed(1)}%.` : 'Cool enough: no change to paces.') : 'Enter the conditions to adjust the paces.'}
        {msg && ` ${msg}`}
      </p>
    </section>
  )
}

/** The fast parts of a fetched run, each against the pace the plan asked for when the two line up. */
function Laps({ w }: { w: Workout }) {
  const settings = useStore((s) => s.settings)
  const laps = w.done?.laps ?? []
  const steps = w.blocks.flatMap((b) => Array.from({ length: b.reps }, () => b.steps).flat())
  const paced = (s: Step) => s.target.t === 'mp' || s.target.t === '5k' || s.target.t === 'pace'
  const work = laps.filter((l) => l.work)

  // The recording may be split exactly like the plan, or only its fast parts may match. Otherwise show the laps without targets.
  let rows: { lap: Lap; step?: Step }[]
  if (laps.length === steps.length) rows = laps.map((lap, i) => ({ lap, step: steps[i] })).filter((r) => paced(r.step))
  else if (work.length === steps.filter(paced).length) rows = work.map((lap, i) => ({ lap, step: steps.filter(paced)[i] }))
  else rows = work.map((lap) => ({ lap }))

  return (
    <ol className="steps">
      {rows.map(({ lap, step }, i) => {
        const pace = lap.sec / lap.km
        const range = step && targetPaces(step.target, settings, heatOf(w))
        return (
          <li className="step" key={i}>
            <span className="step-amount">{lap.km < 1 ? `${Math.round(lap.km * 1000)} m` : `${fmtKm(lap.km)} km`}</span>
            <span className="step-target">
              {range && (pace < range[0] - 2 ? `${Math.round(range[0] - pace)} s fast` : pace > range[1] + 2 ? `${Math.round(pace - range[1])} s slow` : 'On target')}
            </span>
            <span className="step-pace">
              {fmtClock(pace)}
              <small> /km</small>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Result({ w }: { w: Workout }) {
  const settings = useStore((s) => s.settings)
  const shoes = useStore((s) => s.shoes)
  const workouts = useStore((s) => s.workouts)
  const updateWorkout = useStore((s) => s.updateWorkout)
  const isRun = w.kind !== 'strength'
  // Default to the shoe worn on the most recent logged run.
  const lastShoe = [...workouts].filter((x) => x.done?.shoeId).sort((a, b) => b.date.localeCompare(a.date))[0]?.done?.shoeId
  const [km, setKm] = useState(fmtKm(plannedKm(w, settings)))
  const [time, setTime] = useState('')
  const [shoeId, setShoeId] = useState(lastShoe ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  if (w.done) {
    const pace = w.done.km > 0 && w.done.sec > 0 ? w.done.sec / w.done.km : null
    // An average-pace verdict only means something for a run at one easy pace.
    const range = (w.kind === 'easy' || w.kind === 'long') && !w.done.laps ? targetPaces({ t: 'easy' }, settings, heatOf(w)) : null
    return (
      <section className="sheet-section">
        <h3>Done</h3>
        {isRun && (
          <p className="result">
            <span className="big-num">{fmtKm(w.done.km)}<small> km</small></span>
            {w.done.sec > 0 && <span className="big-num">{fmtClock(w.done.sec)}</span>}
            {pace && <span className="big-num">{fmtClock(pace)}<small> /km</small></span>}
          </p>
        )}
        {pace && range && <p>{verdict(pace, range)} ({fmtClock(range[0])}–{fmtClock(range[1])} /km).</p>}
        {w.done.laps && <Laps w={w} />}
        {/* A select, not text: fetched runs get a guessed pair, so it has to be correctable here. */}
        {isRun && shoes.length > 0 && (
          <label>
            Shoes
            <select value={w.done.shoeId ?? ''} onChange={(e) => updateWorkout(w.id, { done: { ...w.done!, shoeId: e.target.value || undefined } })}>
              <option value="">None</option>
              {shoes.filter((s) => !s.retired || s.id === w.done?.shoeId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        {w.done.note && <p>{w.done.note}</p>}
        <button className="btn" onClick={() => updateWorkout(w.id, { done: undefined })}>
          Mark as not done
        </button>
      </section>
    )
  }

  const save = () => {
    if (!isRun) return updateWorkout(w.id, { done: { km: 0, sec: 0, note: note || undefined } })
    const dist = Number(km)
    const sec = time.trim() ? parseClock(time) : 0
    if (!Number.isFinite(dist) || dist <= 0) return setError('Enter the distance in km, like 10.2.')
    if (sec == null) return setError('Enter the time as 52:30 or 1:45:00.')
    updateWorkout(w.id, { done: { km: dist, sec, shoeId: shoeId || undefined, note: note || undefined } })
  }

  return (
    <section className="sheet-section">
      <h3>Log it</h3>
      <div className="fields">
        {isRun && (
          <>
            <label>
              Distance km
              <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
            </label>
            <label>
              Time
              <input inputMode="numeric" placeholder="52:30" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            {shoes.some((s) => !s.retired) && (
              <label>
                Shoes
                <select value={shoeId} onChange={(e) => setShoeId(e.target.value)}>
                  <option value="">None</option>
                  {shoes.filter((s) => !s.retired).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        <label className="wide">
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary" onClick={save}>
        Mark as done
      </button>
    </section>
  )
}

function Edit({ w, onClose }: { w: Workout; onClose: () => void }) {
  const updateWorkout = useStore((s) => s.updateWorkout)
  const removeWorkout = useStore((s) => s.removeWorkout)
  const [src, setSrc] = useState(w.src)
  const [error, setError] = useState('')

  const save = () => {
    try {
      const item = parseItem(src)
      if (!item) return setError('To make this a rest day, remove the workout instead.')
      updateWorkout(w.id, item)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <details className="sheet-section">
      <summary>Change this workout</summary>
      <div className="fields">
        <label className="wide">
          Workout
          <textarea rows={3} value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} />
        </label>
        <label>
          Day
          <input type="date" value={w.date} onChange={(e) => e.target.value && updateWorkout(w.id, { date: e.target.value })} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button className="btn" onClick={save} disabled={src.trim() === w.src}>
          Save changes
        </button>
        <button
          className="btn danger"
          onClick={() => {
            removeWorkout(w.id)
            onClose()
          }}
        >
          Remove workout
        </button>
      </div>
    </details>
  )
}

export function Sheet({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useStore((s) => s.workouts.find((x) => x.id === id))
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!w) return null

  return (
    <div className="scrim" onClick={onClose}>
      <div className={`sheet k-${w.kind}`} role="dialog" aria-modal="true" aria-label={w.title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <p className="muted">{fmtDate(w.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h2>{w.title}</h2>
          </div>
          {w.kind !== 'strength' && (
            <span className="big-num">
              {fmtKm(plannedKm(w, settings))}
              <small> km</small>
            </span>
          )}
          <button className="btn close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <Steps w={w} />
        {w.kind !== 'strength' && !w.done && <Heat w={w} />}
        {/* key resets the form when the workout's done state flips */}
        <Result key={String(!!w.done)} w={w} />
        <Edit key={w.src} w={w} onClose={onClose} />
      </div>
    </div>
  )
}
