import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Check, Plus } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, fmtDate, mondayOf, today } from './lib/dates'
import { fmtKm } from './lib/pace'
import { parseItem } from './lib/parse'
import { plannedKm, useStore, type Workout } from './lib/store'
import { SendButton } from './SendButton'

function Chip({ w, km, maxKm, onOpen }: { w: Workout; km: number; maxKm: number; onOpen: () => void }) {
  // dnd-kit's `attributes` are left off on purpose: they tell screen readers the chip can be dragged with the keyboard, which it can't.
  // The keyboard way to move a workout is the Day field in its sheet.
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: w.id })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      data-workout={w.id}
      className={`chip k-${w.kind}${w.done ? ' done' : ''}${isDragging ? ' dragging' : ''}`}
      // `translate`, not `transform`: the lift in the stylesheet uses `scale`, and a scale would stretch a transform's offset, pulling the chip away from the pointer.
      style={transform ? { translate: `${transform.x}px ${transform.y}px` } : undefined}
      onClick={onOpen}
    >
      <span className="chip-title">
        {w.done ? <Check className="chip-mark" size={13} strokeWidth={2.5} aria-hidden="true" /> : <span className="chip-mark dot" />}
        {w.done && <span className="sr-only">Done: </span>}
        {w.title}
      </span>
      {w.kind !== 'strength' && <span className="chip-km">{fmtKm(km)} km</span>}
      {/* Bar length is the run's distance relative to the longest run in the plan. */}
      {w.kind !== 'strength' && <i className="chip-bar" style={{ width: `${(km / maxKm) * 100}%` }} />}
    </button>
  )
}

function Day({ date, isToday, children, onAdd }: { date: string; isToday: boolean; children: React.ReactNode; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  return (
    <div ref={setNodeRef} className={`day${isOver ? ' over' : ''}${isToday ? ' is-today' : ''}`}>
      <div className="day-label">
        <span>{fmtDate(date, { weekday: 'short' })}</span> <b>{fmtDate(date, { day: 'numeric' })}</b>
      </div>
      <div className="day-items">{children}</div>
      <button className="day-add" onClick={onAdd} aria-label={`Add a workout on ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`}>
        <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}

export function Plan({ onOpen }: { onOpen: (id: string, edit?: boolean) => void }) {
  const workouts = useStore((s) => s.workouts)
  const settings = useStore((s) => s.settings)
  const updateWorkout = useStore((s) => s.updateWorkout)
  const addWorkout = useStore((s) => s.addWorkout)
  const hasKey = useStore((s) => s.icuKey.trim() !== '')
  const now = today()
  const thisWeek = useRef<HTMLElement>(null)

  // A press-and-hold starts a drag on touch screens, so a normal swipe still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  const { weeks, kms, maxKm } = useMemo(() => {
    const kms = new Map(workouts.map((w) => [w.id, w.done?.km ?? plannedKm(w, settings)]))
    const dates = workouts.map((w) => w.date).sort()
    const first = mondayOf(dates[0] ?? now)
    const last = mondayOf(dates[dates.length - 1] ?? now)
    const weeks: string[] = []
    for (let d = first; d <= last; d = addDays(d, 7)) weeks.push(d)
    return { weeks, kms, maxKm: Math.max(1, ...kms.values()) }
  }, [workouts, settings, now])

  useEffect(() => thisWeek.current?.scrollIntoView({ block: 'start' }), [])

  // Where a chip was let go. On release it is drawn in its day at once, so without this it would jump there from under the pointer.
  const [released, setReleased] = useState<{ id: string; left: number; top: number } | null>(null)

  const onDragEnd = (e: DragEndEvent) => {
    const at = e.active.rect.current.translated
    if (at) setReleased({ id: String(e.active.id), left: at.left, top: at.top })
    if (e.over) updateWorkout(String(e.active.id), { date: String(e.over.id) })
  }

  // Glide the chip from where it was let go into its place: start it offset back to the release point, then let the offset run out.
  // A layout effect runs after the chip is in its new place but before the screen is painted, so the jump is never seen.
  useLayoutEffect(() => {
    if (!released) return
    const chip = document.querySelector<HTMLElement>(`[data-workout="${released.id}"]`)
    if (!chip || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const home = chip.getBoundingClientRect()
    chip.animate(
      [
        { translate: `${released.left - home.left}px ${released.top - home.top}px`, scale: 1.03, zIndex: 20 },
        { translate: '0 0', scale: 1, zIndex: 20 },
      ],
      { duration: 200, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    )
  }, [released])

  return (
    <>
      <header className="head">
        <h1>{settings.raceName}</h1>
        <p className="muted">Drag a workout to another day to move it. On a phone, press and hold first.</p>
        {hasKey && <SendButton />}
      </header>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {weeks.map((start, wi) => {
          const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
          const inWeek = workouts.filter((w) => w.date >= start && w.date <= days[6])
          const total = inWeek.reduce((sum, w) => sum + (kms.get(w.id) ?? 0), 0)
          const current = now >= start && now <= days[6]
          return (
            <section key={start} ref={current && wi > 0 ? thisWeek : undefined} className={`week${days[6] < now ? ' past' : ''}`}>
              <header className="week-head">
                <h2>Week {wi + 1}</h2>
                <span className="muted">
                  {fmtDate(start, { day: 'numeric', month: 'short' })} to {fmtDate(days[6], { day: 'numeric', month: 'short' })}
                </span>
                <span className="week-km">
                  {fmtKm(total)}
                  <small> km</small>
                </span>
              </header>
              <div className="week-days">
                {days.map((date) => (
                  <Day key={date} date={date} isToday={date === now} onAdd={() => onOpen(addWorkout(date, parseItem('Easy 8k')!), true)}>
                    {inWeek
                      .filter((w) => w.date === date)
                      .map((w) => (
                        <Chip key={w.id} w={w} km={kms.get(w.id) ?? 0} maxKm={maxKm} onOpen={() => onOpen(w.id)} />
                      ))}
                  </Day>
                ))}
              </div>
            </section>
          )
        })}
      </DndContext>
    </>
  )
}
