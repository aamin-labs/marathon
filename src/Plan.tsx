import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useEffect, useMemo, useRef } from 'react'
import { addDays, fmtDate, mondayOf, today } from './lib/dates'
import { fmtKm } from './lib/pace'
import { parseItem } from './lib/parse'
import { plannedKm, useStore, type Workout } from './lib/store'
import { SendButton } from './SendButton'

function Chip({ w, km, maxKm, onOpen }: { w: Workout; km: number; maxKm: number; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: w.id })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`chip k-${w.kind}${w.done ? ' done' : ''}${isDragging ? ' dragging' : ''}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      onClick={onOpen}
    >
      <span className="chip-title">
        {w.done && <span aria-label="Done">✓ </span>}
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
        +
      </button>
    </div>
  )
}

export function Plan({ onOpen }: { onOpen: (id: string) => void }) {
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

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over) updateWorkout(String(e.active.id), { date: String(e.over.id) })
  }

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
                  <Day key={date} date={date} isToday={date === now} onAdd={() => onOpen(addWorkout(date, parseItem('Easy 8k')!))}>
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
