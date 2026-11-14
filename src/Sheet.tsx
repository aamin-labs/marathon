import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { DateField } from './Fields'
import { slowdown } from './lib/conditions'
import { fmtDate, today } from './lib/dates'
import { parseNumber } from './lib/number'
import { fmtClock, fmtKm, parseRunTime, verdict } from './lib/pace'
import { targetPaces } from './lib/paces'
import { parseItem, type Step } from './lib/parse'
import { plannedKm, useStore, type Lap, type Workout } from './lib/store'
import { useUndo, withUndo } from './lib/undo'
import { canForecast, fetchConditions } from './lib/weather'
import { KindTag, Steps } from './Steps'

/** The weather the paces are adjusted for. It fetches the forecast by itself; the two fields are only there to correct it. */
function Conditions({ w }: { w: Workout }) {
  const settings = useStore((s) => s.settings)
  const updateWorkout = useStore((s) => s.updateWorkout)
  const [temp, setTemp] = useState(w.heat ? String(w.heat.tempC) : '')
  const [dew, setDew] = useState(w.heat ? String(w.heat.dewC) : '')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  // The watch has this workout at the old paces, and a new forecast has just moved them.
  const [resend, setResend] = useState(false)
  // Set once the runner types conditions in this sheet: from then on a forecast still on its way must not replace them.
  const typed = useRef(false)
  const lineId = useId()
  const heat = slowdown(w)
  const { lat, lon } = settings
  const hasPlace = lat != null && lon != null
  const forecastable = !w.done && hasPlace && canForecast(w.date)

  const apply = (t: string, d: string) => {
    typed.current = true
    setTemp(t)
    setDew(d)
    const tempC = parseNumber(t)
    const dewC = parseNumber(d)
    updateWorkout(w.id, { heat: tempC != null && dewC != null ? { tempC, dewC } : undefined })
  }

  /** `wanted` turns false once the answer is no longer needed: the sheet has moved on, or conditions were typed meanwhile. */
  const forecast = async (wanted: () => boolean = () => true) => {
    if (lat == null || lon == null || loading) return
    setLoading(true)
    setFailed(false)
    try {
      const c = await fetchConditions(lat, lon, w.date, settings.runHour)
      if (wanted()) {
        setTemp(String(c.tempC))
        setDew(String(c.dewC))
        const { workouts, pushed } = useStore.getState()
        const saved = workouts.find((x) => x.id === w.id)?.heat
        if (!saved?.auto || saved.tempC !== c.tempC || saved.dewC !== c.dewC) {
          // Saving the forecast is not the runner's doing, so it must not withdraw an "Undo" that is still on offer.
          const { pending } = useUndo.getState()
          updateWorkout(w.id, { heat: { ...c, auto: true } })
          useUndo.setState({ pending })
          if (w.id in pushed && slowdown({ heat: c }) !== slowdown({ heat: saved })) setResend(true)
        }
      }
    } catch {
      if (wanted()) setFailed(true)
    }
    setLoading(false)
  }

  // On opening, get the forecast, or a newer one: it sharpens as the day gets closer. Conditions entered by hand are left alone.
  // Moving the workout to another day asks again, and drops a forecast that belonged to the old day.
  useEffect(() => {
    if (w.done || (w.heat && !w.heat.auto)) return
    if (!forecastable) {
      if (w.heat && w.date > today()) updateWorkout(w.id, { heat: undefined })
      return
    }
    let open = true
    forecast(() => open && !typed.current)
    return () => {
      open = false
    }
  }, [w.id, w.date])

  let line = ''
  if (w.heat) {
    line = `${w.heat.auto ? `Forecast for ${settings.runHour}:00: ` : ''}${w.heat.tempC}° · dew point\u00A0${w.heat.dewC}° · ${heat > 0 ? `paces slowed\u00A0${heat.toFixed(1)}%` : 'no change to paces'}`
    if (resend) line += '. Send it to the watch again for the new paces.'
  } else if (loading) line = 'Getting the forecast…'
  else if (failed) line = 'Couldn’t get the forecast.'
  else if (!hasPlace) line = 'Set your location in Setup and the paces adjust for the forecast by themselves.'
  else if (!forecastable) line = w.date < today() ? 'No forecast for a day that has passed.' : 'The forecast reaches two weeks ahead. Paces adjust for the heat nearer the day.'
  else line = 'Paces are not adjusted for the heat.'

  // A done workout keeps the conditions it was run in, if there were any, and nothing can be changed.
  if (w.done) return w.heat ? <p className="muted">{line}</p> : null

  return (
    <div className="conditions">
      <p className="muted" id={lineId} aria-live="polite">
        {line}
      </p>
      {/* The same words open or shut: aria-expanded says which, and the line beside it says what is being changed. */}
      <button className="btn quiet" aria-expanded={editing} aria-describedby={lineId} onClick={() => setEditing(!editing)}>
        {w.heat ? 'Change' : 'Enter by hand'}
      </button>
      {editing && (
        <div className="fields">
          {/* The full keyboard, not the number pad: the phone's number pad has no minus, and dew points go below zero. */}
          <label>
            Temperature
            <span className="affix">
              <input inputMode="text" autoComplete="off" value={temp} onChange={(e) => apply(e.target.value, dew)} />
              <span>°C</span>
            </span>
          </label>
          <label>
            Dew point
            <span className="affix">
              <input inputMode="text" autoComplete="off" value={dew} onChange={(e) => apply(temp, e.target.value)} />
              <span>°C</span>
            </span>
          </label>
          {/* Not disabled while it works, and not taken away after: either would drop keyboard focus. A second press is ignored instead. */}
          {forecastable && (
            <button className="btn" aria-disabled={loading} onClick={() => forecast()}>
              {loading ? 'Getting the forecast…' : 'Use the forecast'}
            </button>
          )}
        </div>
      )}
    </div>
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
        const range = step && targetPaces(step.target, settings, slowdown(w))
        return (
          <li className="step" key={i}>
            <span className="step-amount">{lap.km < 1 ? `${Math.round(lap.km * 1000)}\u00A0m` : `${fmtKm(lap.km)}\u00A0km`}</span>
            <span className="step-target">
              {range && (pace < range[0] - 2 ? `${Math.round(range[0] - pace)}\u00A0s fast` : pace > range[1] + 2 ? `${Math.round(pace - range[1])}\u00A0s slow` : 'On target')}
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

/**
 * A number field in the result that saves itself: every usable value goes straight to the workout, so there is nothing to submit.
 * It complains late and forgives early: the error appears on leaving the field, then clears on the keystroke that fixes it.
 * (Unlike NumberField in Fields.tsx, which quietly puts the old value back: here what was typed stays, with the reason it can't be used.)
 */
function ResultField({
  label,
  unit,
  error,
  value,
  show,
  parse,
  onSave,
  ...input
}: {
  label: string
  unit?: string
  error: string
  value: number
  show: (n: number) => string
  parse: (text: string) => number | null
  onSave: (n: number) => void
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, 'inputMode' | 'placeholder'>) {
  const [text, setText] = useState(show(value))
  const [lastValue, setLastValue] = useState(value)
  const [flagged, setFlagged] = useState(false)
  // The value when the field was entered: what goes back if it is left with something unusable in it.
  const onEntry = useRef(value)
  const errorId = useId()
  // The value changed from outside the field (a fetched run, an undo): show the new one.
  if (value !== lastValue) {
    setLastValue(value)
    if (parse(text) !== value) {
      setText(show(value))
      setFlagged(false)
    }
  }

  const field = (
    <input
      {...input}
      autoComplete="off"
      value={text}
      aria-invalid={flagged}
      aria-describedby={flagged ? errorId : undefined}
      onFocus={() => (onEntry.current = value)}
      onChange={(e) => {
        setText(e.target.value)
        const n = parse(e.target.value)
        if (n != null) onSave(n)
        if (flagged) setFlagged(n == null)
      }}
      onBlur={() => {
        if (parse(text) != null) return setFlagged(false)
        setFlagged(true)
        // On the way to something unusable, a half-typed value may have been saved: "52:30" passes through "52:3". Put back what was there before.
        setLastValue(onEntry.current)
        if (value !== onEntry.current) onSave(onEntry.current)
      }}
    />
  )
  return (
    <div className="stack">
      <label>
        {label}
        {unit ? (
          <span className="affix">
            {field}
            <span>{unit}</span>
          </span>
        ) : (
          field
        )}
      </label>
      {flagged && (
        <span className="error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/** The one part of the sheet that is the runner's to fill in. Ticking "Done" records the workout as planned; the details can be corrected after. */
function Result({ w }: { w: Workout }) {
  const settings = useStore((s) => s.settings)
  const shoes = useStore((s) => s.shoes)
  const updateWorkout = useStore((s) => s.updateWorkout)
  const isRun = w.kind !== 'strength'
  const done = w.done
  // True once the box is ticked in this sheet, as opposed to the workout being opened already done.
  const [fresh, setFresh] = useState(false)
  // The result as it was before the box was unticked, so ticking it again puts it all back.
  const unticked = useRef<Workout['done']>(undefined)

  const toggle = (checked: boolean) => {
    if (checked) {
      // Default to the shoe worn on the most recent done run.
      const lastShoe = [...useStore.getState().workouts].filter((x) => x.done?.shoeId).sort((a, b) => b.date.localeCompare(a.date))[0]?.done?.shoeId
      const shoeId = shoes.some((s) => s.id === lastShoe && !s.retired) ? lastShoe : undefined
      setFresh(true)
      updateWorkout(w.id, { done: unticked.current ?? (isRun ? { km: Math.round(plannedKm(w, settings) * 10) / 10, sec: 0, shoeId } : { km: 0, sec: 0 }) })
      unticked.current = undefined
    } else {
      unticked.current = done
      updateWorkout(w.id, { done: undefined })
    }
  }
  // Unticking throws away the distance, time and note. While the sheet is open, ticking again puts them back.
  // The "Undo" message sits on the page behind the sheet, so it is offered as the sheet closes: the result goes back for a moment and is removed again as one undoable change.
  useEffect(
    () => () => {
      const { workouts, updateWorkout } = useStore.getState()
      const lost = unticked.current
      if (!lost || !workouts.some((x) => x.id === w.id && !x.done)) return
      updateWorkout(w.id, { done: lost })
      withUndo('Marked as not done', () => updateWorkout(w.id, { done: undefined }))
    },
    [w.id],
  )
  const save = (patch: Partial<NonNullable<Workout['done']>>) => done && updateWorkout(w.id, { done: { ...done, ...patch } })

  const pace = done && done.km > 0 && done.sec > 0 ? done.sec / done.km : null
  // An average-pace verdict only means something for a run at one easy pace.
  const range = done && (w.kind === 'easy' || w.kind === 'long') && !done.laps ? targetPaces({ t: 'easy' }, settings, slowdown(w)) : null

  return (
    // A form so the fields behave like one; there is nothing to submit, because each field saves itself.
    <form className={`result${done ? ' done' : ''}`} onSubmit={(e) => e.preventDefault()}>
      <h3>How it went</h3>
      <label className="check">
        <input type="checkbox" checked={!!done} onChange={(e) => toggle(e.target.checked)} />
        Done
      </label>
      {done && (
        <div className={`result-details${fresh ? ' fresh' : ''}`}>
          {isRun && (pace || done.laps) && (
            <p className="result-nums">
              {/* A fetched run's distance and time are the watch's, shown as text: typing over them would leave its laps not adding up. */}
              {done.laps && <span className="big-num">{fmtKm(done.km)}<small> km</small></span>}
              {done.laps && done.sec > 0 && <span className="big-num">{fmtClock(done.sec)}</span>}
              {pace && <span className="big-num">{fmtClock(pace)}<small> /km</small></span>}
              {pace && range && <span>{verdict(pace, range)} ({fmtClock(range[0])}–{fmtClock(range[1])}&nbsp;/km).</span>}
            </p>
          )}
          {done.laps && <Laps w={w} />}
          <div className="fields">
            {isRun && !done.laps && (
              <>
                <ResultField
                  label="Distance"
                  unit="km"
                  inputMode="decimal"
                  error="Enter the distance in km, like 10.2."
                  value={done.km}
                  show={fmtKm}
                  parse={(t) => parseNumber(t, { min: 0 }) || null}
                  onSave={(km) => save({ km })}
                />
                {/* The full keyboard: the number pad has no colon. */}
                <ResultField
                  label="Time (mm:ss)"
                  inputMode="text"
                  placeholder="52:30"
                  error="Enter the time as 52:30, or 1:45:00 with hours."
                  value={done.sec}
                  show={(sec) => (sec > 0 ? fmtClock(sec) : '')}
                  parse={parseRunTime}
                  onSave={(sec) => save({ sec })}
                />
              </>
            )}
            {/* A select, not text: fetched runs get a guessed pair, so it has to be correctable here. */}
            {isRun && shoes.some((s) => !s.retired || s.id === done.shoeId) && (
              <label>
                Shoes
                <select value={done.shoeId ?? ''} onChange={(e) => save({ shoeId: e.target.value || undefined })}>
                  <option value="">None</option>
                  {shoes.filter((s) => !s.retired || s.id === done.shoeId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="wide">
              Note
              <input autoComplete="off" value={done.note ?? ''} onChange={(e) => save({ note: e.target.value || undefined })} />
            </label>
          </div>
        </div>
      )}
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
  // It first plays its exit (see [data-closing] in the stylesheet), then closes for real.
  const close = () => {
    const dialog = ref.current
    if (!dialog) return
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
      onClose={onClose}
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
        <button className="btn close" onClick={close} aria-label="Close">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      {/* The plan, as text to read. Only the result below it has fields to fill in. */}
      <Steps w={w} />
      {w.kind !== 'strength' && <Conditions w={w} />}
      <Result w={w} />
      <Edit w={w} startOpen={startEditing} onClose={onClose} />
    </dialog>
  )
}
