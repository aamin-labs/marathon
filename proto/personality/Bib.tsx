// Throwaway prototype variant: "Bib". Race-day graphics: condensed signage type, the distance as a bib number, one hi-vis colour.
import { Check } from 'lucide-react'
import { daysBetween, fmtDate } from './snapshot/src/lib/dates'
import { fmtClock, fmtKm } from './snapshot/src/lib/pace'
import { heatOf, Steps } from './snapshot/src/Steps'
import { KIND_NAMES, kmOf, useDay } from './data'
import type { TodayProps } from './Shell'

export function Bib({ onOpen, onSetup }: TodayProps) {
  const { now, settings, days, todays, next, weekPlanned, weekDone, weeks, weekNo, hasPlan } = useDay()
  const toRace = daysBetween(now, settings.raceDate)
  const nextUp = todays.find((w) => !w.done)?.id

  return (
    <div className="bib-page">
      <header className="bib-head">
        <h1>{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'short' })}</h1>
        {hasPlan && (
          <p className="bib-count">
            {toRace > 0 ? (
              <>
                <b>{toRace}</b> {toRace === 1 ? 'day' : 'days'} to {settings.raceName}
              </>
            ) : toRace === 0 ? (
              `${settings.raceName} is today`
            ) : (
              `${settings.raceName} is done`
            )}
          </p>
        )}
      </header>

      {hasPlan && (
        <section className="bib-week" aria-label="This week">
          <ol>
            {days.map((d) => {
              const w = d.main
              const cls = `bib-cell${w ? ` k-${w.kind}` : ''}${d.allDone ? ' done' : ''}${d.isToday ? ' is-today' : ''}`
              const inner = (
                <>
                  <span className="bib-cell-day">{fmtDate(d.date, { weekday: 'short' })}</span>
                  <span className="bib-cell-km">{d.km > 0 ? fmtKm(d.km) : w ? 'S' : '–'}</span>
                  <span className="bib-cell-foot">
                    {d.allDone ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                    <span>{w ? KIND_NAMES[w.kind] : 'Rest'}</span>
                  </span>
                </>
              )
              const say = `${fmtDate(d.date, { weekday: 'long' })}: ${w ? d.items.map((x) => x.title).join(' and ') : 'rest'}${d.km > 0 ? `, ${fmtKm(d.km)} km` : ''}${d.allDone ? ', done' : ''}${d.isToday ? ' (today)' : ''}`
              return (
                <li key={d.date}>
                  {w ? (
                    <button className={cls} onClick={() => onOpen(w.id)} aria-label={say}>
                      {inner}
                    </button>
                  ) : (
                    <div className={cls} role="img" aria-label={say}>
                      {inner}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="bib-total">
            <span>
              <b>{fmtKm(weekDone)}</b> / {fmtKm(weekPlanned)}&nbsp;km this week
            </span>
            {weekNo > 0 && (
              <span>
                Week {weekNo} of {weeks.length}
              </span>
            )}
          </p>
        </section>
      )}

      <div className="today-grid">
        <div className="today-main">
          {!hasPlan ? (
            <section className="bib">
              <div className="bib-band">
                <span>No plan yet</span>
              </div>
              <div className="bib-body">
                <h2>Nothing on the calendar</h2>
              </div>
              <p className="muted">Lay a plan onto the calendar and today’s workout will show up here.</p>
              <button className="btn primary" onClick={onSetup}>
                Go to Setup
              </button>
            </section>
          ) : (
            todays.length === 0 && (
              <section className="bib">
                <div className="bib-band">
                  <span>Rest</span>
                </div>
                <div className="bib-body">
                  <p className="bib-num">
                    0<small>km</small>
                  </p>
                  <h2>Rest day</h2>
                </div>
                <p className="muted">{next[0] ? `Nothing planned today. Next is ${next[0].title} on ${fmtDate(next[0].date, { weekday: 'long' })}.` : 'Nothing planned today.'}</p>
              </section>
            )
          )}

          {todays.map((w) => {
            const heat = heatOf(w)
            return (
              <section key={w.id} className={`bib k-${w.kind}`}>
                <div className="bib-band">
                  <span>{KIND_NAMES[w.kind]}</span>
                  {w.kind === 'race' && settings.goalTime && <span>Goal {settings.goalTime}</span>}
                </div>
                <div className="bib-body">
                  {w.kind !== 'strength' && (
                    <p className="bib-num">
                      {fmtKm(kmOf(w, settings))}
                      <small>km</small>
                    </p>
                  )}
                  <h2>{w.title}</h2>
                  {w.done && (
                    <p className="bib-stamp">
                      Done{w.done.sec ? <span>{fmtClock(w.done.sec)}</span> : null}
                    </p>
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

        {next.length > 0 && (
          <aside className="today-side">
            <section className="bib-next">
              <h2>Coming up</h2>
              <ul className="upcoming">
                {next.map((w) => (
                  <li key={w.id}>
                    <button className={`row-btn k-${w.kind}`} onClick={() => onOpen(w.id)}>
                      <span className="bib-next-day">{fmtDate(w.date, { weekday: 'short', day: 'numeric' })}</span>
                      <span className="row-title">{w.title}</span>
                      {w.kind !== 'strength' && <span className="muted">{fmtKm(kmOf(w, settings))}&nbsp;km</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}
