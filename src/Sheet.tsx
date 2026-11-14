import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DateField } from './Fields'
import { fmtDate } from './lib/dates'
import { parseNumber } from './lib/number'
import { fmtClock, fmtKm, parseClock, targetPaces, verdict } from './lib/pace'
import { parseItem, type Step } from './lib/parse'
import { plannedKm, useStore, type Lap, type Workout } from './lib/store'
import { withUndo } from './lib/undo'
import { fetchConditions } from './lib/weather'
import { heatOf, KindTag, Steps } from './Steps'

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
    const tempC = parseNumber(t)
    const dewC = parseNumber(d)
    updateWorkout(w.id, { heat: tempC != null && dewC != null ? { tempC, dewC } : undefined })
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
        {/* The full keyboard, not the number pad: the phone's number pad has no minus, and dew points go below zero. */}
        <label>
          Temperature °C
          <input inputMode="text" value={temp} onChange={(e) => apply(e.target.value, dew)} />
        </label>
        <label>
          Dew point °C
          <input inputMode="text" value={dew} onChange={(e) => apply(temp, e.target.value)} />
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

/** `fresh` is true when the workout was logged a moment ago in this sheet, as opposed to opened already done. */
function Result({ w, fresh, onLogged, onClose }: { w: Workout; fresh: boolean; onLogged: () => void; onClose: (then?: () => void) => void }) {
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
  // Logging swaps the form for the result, taking the pressed button with it. Keyboard focus moves to the result's heading, or it would be left nowhere.
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (fresh) heading.current?.focus()
  }, [fresh])

  if (w.done) {
    const pace = w.done.km > 0 && w.done.sec > 0 ? w.done.sec / w.done.km : null
    // An average-pace verdict only means something for a run at one easy pace.
    const range = (w.kind === 'easy' || w.kind === 'long') && !w.done.laps ? targetPaces({ t: 'easy' }, settings, heatOf(w)) : null
    return (
      <section className="sheet-section">
        <h3 ref={heading} tabIndex={-1}>
          Done
        </h3>
        {isRun && (
          <p className={`result${fresh ? ' fresh' : ''}`}>
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
        {/* This throws away the logged distance, time and note, so it can be undone. The sheet closes first: the undo message sits on the page behind it. */}
        <button className="btn" onClick={() => onClose(() => withUndo('Marked as not done', () => updateWorkout(w.id, { done: undefined })))}>
          Mark as not done
        </button>
      </section>
    )
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (isRun) {
      const dist = parseNumber(km)
      const sec = time.trim() ? parseClock(time) : 0
      if (dist == null || dist <= 0) return setError('Enter the distance in km, like 10.2.')
      // A time with no colon is a slip, not seconds: "5230" would otherwise be logged as 1:27:10.
      if (sec == null || (sec > 0 && !time.includes(':'))) return setError('Enter the time as 52:30 or 1:45:00.')
      updateWorkout(w.id, { done: { km: dist, sec, shoeId: shoeId || undefined, note: note || undefined } })
    } else updateWorkout(w.id, { done: { km: 0, sec: 0, note: note || undefined } })
    onLogged()
  }

  return (
    <form className="sheet-section" onSubmit={save}>
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
              <input inputMode="text" placeholder="52:30" value={time} onChange={(e) => setTime(e.target.value)} />
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
      <p className="error status-line" role="alert">{error}</p>
      <button className="btn primary">Mark as done</button>
    </form>
  )
}

/** `startOpen` shows the section already open: a workout that was just added is a placeholder waiting to be changed. */
function Edit({ w, startOpen, onClose }: { w: Workout; startOpen: boolean; onClose: () => void }) {
  const updateWorkout = useStore((s) => s.updateWorkout)
  const removeWorkout = useStore((s) => s.removeWorkout)
  const [src, setSrc] = useState(w.src)
  // The day waits for "Save changes" like the text does: one section, one way of saving.
  const [date, setDate] = useState(w.date)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const unchanged = src.trim() === w.src && date === w.date

  const save = () => {
    try {
      const item = parseItem(src)
      if (!item) return setError('To make this a rest day, remove the workout instead.')
      updateWorkout(w.id, { ...item, date })
      setSrc(item.src)
      setError('')
      setSaved(true)
    } catch (e) {
      setSaved(false)
      setError((e as Error).message)
    }
  }

  return (
    <details className="sheet-section" open={startOpen}>
      <summary>Change this workout</summary>
      <div className="fields">
        <label className="wide">
          Workout
          {/* Enter adds a line here, so saving from the keyboard is Cmd+Enter (Ctrl+Enter on Windows). */}
          <textarea
            rows={3}
            value={src}
            onChange={(e) => {
              setSrc(e.target.value)
              setSaved(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !unchanged && save()}
            spellCheck={false}
          />
        </label>
        <label>
          Day
          <DateField
            value={date}
            onSave={(d) => {
              setDate(d)
              setSaved(false)
            }}
          />
        </label>
      </div>
      {/* One line, always there: it carries the error or the confirmation, and the buttons below stay put. */}
      <p className={`status-line ${error ? 'error' : 'muted'}`} role={error ? 'alert' : 'status'}>
        {error || (saved && 'Saved.')}
      </p>
      <div className="btn-row">
        <button className="btn" onClick={save} disabled={unchanged}>
          Save changes
        </button>
        <button
          className="btn danger"
          onClick={() => {
            onClose()
            withUndo('Workout removed', () => removeWorkout(w.id))
          }}
        >
          Remove workout
        </button>
      </div>
    </details>
  )
}

export function Sheet({ id, startEditing = false, onClose }: { id: string; startEditing?: boolean; onClose: () => void }) {
  const w = useStore((s) => s.workouts.find((x) => x.id === id))
  const settings = useStore((s) => s.settings)

  const ref = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)
  const [logged, setLogged] = useState(false)
  // Something to do once the sheet has finished closing.
  const afterClose = useRef<(() => void) | undefined>(undefined)

  // showModal is what makes it a real modal: focus moves in and stays in, Escape closes it, the page behind can't be reached.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // A just-added workout opens with its text selected, ready to be typed over.
    const text = startEditing && dialog.querySelector<HTMLTextAreaElement>('details textarea')
    if (text) {
      text.focus()
      text.select()
    }
  }, [startEditing])

  if (!w) return null

  // Closing through the dialog itself, not just unmounting it, is what sends focus back to the button that opened it.
  // (Removing the workout skips this and unmounts directly: the chip that opened the sheet is gone too.)
  // It first plays its exit (see [data-closing] in the stylesheet), then closes for real, then runs `then` if there is one.
  const close = (then?: () => void) => {
    const dialog = ref.current
    if (!dialog) return
    if (then) afterClose.current = then
    if ('closing' in dialog.dataset || matchMedia('(prefers-reduced-motion: reduce)').matches) return dialog.close()
    dialog.dataset.closing = ''
    dialog.addEventListener('animationend', (e) => e.target === dialog && dialog.close())
  }
  // The backdrop belongs to the dialog element, so a click on it is a click on the dialog that lands outside its box.
  const isOnBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
  }

  return (
    <dialog
      ref={ref}
      className={`sheet k-${w.kind}`}
      aria-label={w.title}
      onClose={() => {
        onClose()
        afterClose.current?.()
      }}
      // Escape would close it on the spot; send it through the same exit as the close button.
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      // Only a press that both starts and ends on the backdrop closes it: dragging to select text in a field can end out there.
      onMouseDown={(e) => (pressedBackdrop.current = isOnBackdrop(e))}
      onClick={(e) => pressedBackdrop.current && isOnBackdrop(e) && close()}
    >
      <header className="sheet-head">
        <div>
          <KindTag kind={w.kind} />
          <h2>{w.title}</h2>
          <p className="muted">{fmtDate(w.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {w.kind !== 'strength' && (
          <span className="big-num">
            {fmtKm(plannedKm(w, settings))}
            <small> km</small>
          </span>
        )}
        <button className="btn close" onClick={() => close()} aria-label="Close">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <Steps w={w} />
      {w.kind !== 'strength' && !w.done && <Heat w={w} />}
      {/* key resets the form when the workout's done state flips */}
      <Result key={String(!!w.done)} w={w} fresh={logged} onLogged={() => setLogged(true)} onClose={close} />
      <Edit w={w} startOpen={startEditing} onClose={onClose} />
    </dialog>
  )
}
