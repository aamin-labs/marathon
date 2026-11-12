import { useMemo } from 'react'
import { addDays, daysBetween, fmtDate, mondayOf, today } from './lib/dates'
import { fmtKm } from './lib/pace'
import { plannedKm, useStore } from './lib/store'
import { heatOf, Steps } from './Steps'

export function Today({ onOpen }: { onOpen: (id: string) => void }) {
  const workouts = useStore((s) => s.workouts)
  const settings = useStore((s) => s.settings)
  const now = today()

  const { todays, next, weekPlanned, weekDone } = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
    const start = mondayOf(now)
    const week = sorted.filter((w) => w.date >= start && w.date <= addDays(start, 6))
    return {
      todays: sorted.filter((w) => w.date === now),
      next: sorted.filter((w) => w.date > now && !w.done).slice(0, 3),
      weekPlanned: week.reduce((sum, w) => sum + (w.done?.km ?? plannedKm(w, settings)), 0),
      weekDone: week.reduce((sum, w) => sum + (w.done?.km ?? 0), 0),
    }
  }, [workouts, settings, now])

  const toRace = daysBetween(now, settings.raceDate)

  return (
    <>
      <header className="head">
        <h1>{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        <p className="muted">
          {toRace > 0
            ? `${Math.floor(toRace / 7)} weeks and ${toRace % 7} days to ${settings.raceName}`
            : toRace === 0
              ? `${settings.raceName} is today`
              : `${settings.raceName} is done`}
        </p>
      </header>

      {todays.length === 0 && (
        <section className="card">
          <h2>Rest day</h2>
        </section>
      )}

      {todays.map((w) => {
        const heat = heatOf(w)
        return (
          <section key={w.id} className={`card today k-${w.kind}`}>
            <div className="today-top">
              <h2>{w.title}</h2>
              {w.kind !== 'strength' && (
                <span className="big-num">
                  {fmtKm(w.done?.km ?? plannedKm(w, settings))}
                  <small> km</small>
                </span>
              )}
            </div>
            {heat > 0 && <p className="heat-note">Paces slowed {heat.toFixed(1)}% for the heat</p>}
            <Steps w={w} />
            <button className="btn primary" onClick={() => onOpen(w.id)}>
              {w.done ? 'See how it went' : 'Open workout'}
            </button>
          </section>
        )
      })}

      <section className="plain">
        <h2>This week</h2>
        <div className="meter" role="img" aria-label={`${fmtKm(weekDone)} of ${fmtKm(weekPlanned)} km done`}>
          <i style={{ width: `${weekPlanned ? Math.min(100, (weekDone / weekPlanned) * 100) : 0}%` }} />
        </div>
        <p className="muted">
          {fmtKm(weekDone)} of {fmtKm(weekPlanned)} km done
        </p>
      </section>

      {next.length > 0 && (
        <section className="plain">
          <h2>Coming up</h2>
          <ul className="upcoming">
            {next.map((w) => (
              <li key={w.id}>
                <button className={`row-btn k-${w.kind}`} onClick={() => onOpen(w.id)}>
                  <span className="dot" />
                  <span className="row-title">{w.title}</span>
                  <span className="muted">{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
