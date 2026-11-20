import { useMemo } from 'react'
import { addDays, daysBetween, fmtCountdown, fmtDate, mondayOf, today } from './lib/dates'
import { fmtKm } from './lib/pace'
import { plannedKm, useStore } from './lib/store'
import { heatOf, KindTag, Steps } from './Steps'

export function Today({ onOpen, onSetup }: { onOpen: (id: string) => void; onSetup: () => void }) {
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
  // One primary button on the page: the first of today's workouts still to do.
  const nextUp = todays.find((w) => !w.done)?.id

  return (
    <>
      <header className="head">
        <h1>{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        <p className="muted">{toRace > 0 ? `${fmtCountdown(toRace)} to ${settings.raceName}` : toRace === 0 ? `${settings.raceName} is today` : `${settings.raceName} is done`}</p>
      </header>

      <div className="today-grid">
        <div className="today-main">
          {workouts.length === 0 ? (
            <section className="card">
              <h2>No schedule yet</h2>
              <p className="muted">Build one from your plan and today’s workout will show up here.</p>
              <button className="btn primary" onClick={onSetup}>
                Go to Setup
              </button>
            </section>
          ) : (
            todays.length === 0 && (
              <section className="card">
                <h2>Rest day</h2>
                <p className="muted">
                  {next[0] ? `Nothing planned today. Next is ${next[0].title} on ${fmtDate(next[0].date, { weekday: 'long' })}.` : 'Nothing planned today.'}
                </p>
              </section>
            )
          )}

          {todays.map((w) => {
            const heat = heatOf(w)
            return (
              <section key={w.id} className="card">
                <div className="today-top">
                  <div>
                    <KindTag kind={w.kind} />
                    <h2>{w.title}</h2>
                  </div>
                  {w.kind !== 'strength' && (
                    <span className="big-num">
                      {fmtKm(w.done?.km ?? plannedKm(w, settings))}
                      <small> km</small>
                    </span>
                  )}
                </div>
                {heat > 0 && <p className="heat-note">Paces slowed {heat.toFixed(1)}% for the heat</p>}
                <Steps w={w} />
                <button className={`btn${w.id === nextUp ? ' primary' : ''}`} onClick={() => onOpen(w.id)}>
                  {w.done ? 'See how it went' : 'Open workout'}
                </button>
              </section>
            )
          })}
        </div>
        <aside className="today-side">
          <section className="card">
            <h2>This week</h2>
            <div className="meter" role="img" aria-label={`${fmtKm(weekDone)} of ${fmtKm(weekPlanned)} km done`}>
              <i style={{ transform: `translateX(${(weekPlanned ? Math.min(100, (weekDone / weekPlanned) * 100) : 0) - 100}%)` }} />
            </div>
            <p className="muted">
              {fmtKm(weekDone)} of {fmtKm(weekPlanned)}&nbsp;km done
            </p>
          </section>

          {next.length > 0 && (
            <section className="card">
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
        </aside>
      </div>
    </>
  )
}
