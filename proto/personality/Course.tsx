// Throwaway prototype variant: "Course". Same look as today's app; the personality is the plan drawn as a course you are part-way along.
import { useState } from 'react'
import { addDays, daysBetween, fmtCountdown, fmtDate } from './snapshot/src/lib/dates'
import { fmtKm } from './snapshot/src/lib/pace'
import type { Workout } from './snapshot/src/lib/store'
import { heatOf, KindTag, Steps } from './snapshot/src/Steps'
import { effort, kmOf, useDay } from './data'
import type { TodayProps } from './Shell'

/** The whole plan as one line: weekly distance rising to its peak and tapering into the race, with a marker on this week. */
function Profile({ weeks, weekNo, raceName }: { weeks: { start: string; km: number }[]; weekNo: number; raceName: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = weeks.length
  const max = Math.max(...weeks.map((w) => w.km), 1)
  const H = 100
  const x = (i: number) => ((i + 0.5) / n) * 100
  const y = (km: number) => H - 6 - (km / max) * (H - 14)
  // Each week's point joined to the next with a curve that leaves and arrives level, so it never dips below a week's value.
  let line = `M0 ${y(weeks[0].km)} L${x(0)} ${y(weeks[0].km)}`
  for (let i = 1; i < n; i++) {
    const mid = (x(i - 1) + x(i)) / 2
    line += ` C${mid} ${y(weeks[i - 1].km)} ${mid} ${y(weeks[i].km)} ${x(i)} ${y(weeks[i].km)}`
  }
  line += ` L100 ${y(weeks[n - 1].km)}`
  const area = `${line} L100 ${H} L0 ${H} Z`
  const here = weekNo > 0 ? weekNo - 1 : null
  const peak = weeks.findIndex((w) => w.km === max)
  const shown = hover ?? here
  const edge = (i: number) => (x(i) < 12 ? ' at-start' : x(i) > 88 ? ' at-end' : '')

  return (
    <section className="course" aria-label="The plan, week by week">
      <div className="course-plot">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label={`Weekly distance across ${n} weeks, peaking at ${fmtKm(max)} km in week ${peak + 1}.${here != null ? ` This is week ${here + 1}.` : ''}`}>
          <path className="course-area" d={area} />
          {here != null && <path className="course-area past" d={area} style={{ clipPath: `inset(0 ${100 - x(here)}% 0 0)` }} />}
          <path className="course-line" d={line} vectorEffect="non-scaling-stroke" />
          {here != null && <path className="course-line past" d={line} vectorEffect="non-scaling-stroke" style={{ clipPath: `inset(0 ${100 - x(here)}% 0 0)` }} />}
        </svg>
        {shown != null && <i className="course-rule" style={{ left: `${x(shown)}%` }} />}
        {here != null && <i className="course-dot" style={{ left: `${x(here)}%`, top: `${y(weeks[here].km)}%` }} />}
        {hover != null && hover !== here && <i className="course-dot hover" style={{ left: `${x(hover)}%`, top: `${y(weeks[hover].km)}%` }} />}
        {shown != null && (
          <span className={`course-tag${edge(shown)}`} style={{ left: `${x(shown)}%` }}>
            <b>Week {shown + 1}</b> {fmtKm(weeks[shown].km)}&nbsp;km{shown === here ? ' · you are here' : ''}
          </span>
        )}
        {/* One strip per week takes the pointer, so any week can be read off. */}
        <div className="course-hits" onPointerLeave={() => setHover(null)}>
          {weeks.map((w, i) => (
            <i key={w.start} onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(i)} />
          ))}
        </div>
      </div>
      <div className="course-axis">
        <span>{fmtDate(weeks[0].start, { day: 'numeric', month: 'short' })}</span>
        <span>
          Peak {fmtKm(max)}&nbsp;km, week {peak + 1}
        </span>
        <span>
          {raceName} · {fmtDate(addDays(weeks[n - 1].start, 6), { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </section>
  )
}

/** The workout as a strip: each stretch as wide as it is long and as tall as it is hard. */
function Effort({ w }: { w: Workout }) {
  const { settings } = useDay()
  const steps = effort(w, settings)
  if (steps.length < 2) return null
  return (
    <div className="effort" role="img" aria-label={`The workout drawn as ${steps.length} stretches: wider is longer, taller is faster.`}>
      {steps.map((s, i) => (
        <i key={i} style={{ flexGrow: s.km, height: `${s.level * 100}%` }} />
      ))}
    </div>
  )
}

export function Course({ onOpen, onSetup }: TodayProps) {
  const { now, settings, days, todays, next, weekPlanned, weekDone, weeks, weekNo, hasPlan } = useDay()
  const toRace = daysBetween(now, settings.raceDate)
  const nextUp = todays.find((w) => !w.done)?.id
  const maxDay = Math.max(...days.map((d) => d.km), 1)

  return (
    <div className="course-page">
      <header className="head">
        <h1>{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        <p className="muted">{toRace > 0 ? `${fmtCountdown(toRace)} to ${settings.raceName}` : toRace === 0 ? `${settings.raceName} is today` : `${settings.raceName} is done`}</p>
      </header>

      {weeks.length > 1 && <Profile weeks={weeks} weekNo={weekNo} raceName={settings.raceName} />}

      <div className="today-grid">
        <div className="today-main">
          {!hasPlan ? (
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
                <p className="muted">{next[0] ? `Nothing planned today. Next is ${next[0].title} on ${fmtDate(next[0].date, { weekday: 'long' })}.` : 'Nothing planned today.'}</p>
              </section>
            )
          )}

          {todays.map((w) => {
            const heat = heatOf(w)
            return (
              <section key={w.id} className={`card k-${w.kind}`}>
                <div className="today-top">
                  <div>
                    <KindTag kind={w.kind} />
                    <h2>{w.title}</h2>
                  </div>
                  {w.kind !== 'strength' && (
                    <span className="big-num">
                      {fmtKm(kmOf(w, settings))}
                      <small> km</small>
                    </span>
                  )}
                </div>
                {w.kind !== 'strength' && <Effort w={w} />}
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
          {hasPlan && (
            <section className="card">
              <div className="wk-head">
                <h2>This week</h2>
                <span className="wk-total">
                  <b>{fmtKm(weekDone)}</b> / {fmtKm(weekPlanned)}
                  <small> km</small>
                </span>
              </div>
              <ol className="wk-bars">
                {days.map((d) => {
                  const w = d.main
                  const say = `${fmtDate(d.date, { weekday: 'long' })}: ${w ? d.items.map((x) => x.title).join(' and ') : 'rest'}${d.km > 0 ? `, ${fmtKm(d.km)} km` : ''}${d.allDone ? ', done' : ''}${d.isToday ? ' (today)' : ''}`
                  const inner = (
                    <>
                      <span className="wk-track">
                        <i style={{ height: d.km > 0 ? `${Math.max(6, (d.km / maxDay) * 100)}%` : undefined }} />
                      </span>
                      <span className="wk-km">{d.km > 0 ? fmtKm(d.km) : '·'}</span>
                      <span className="wk-day">{fmtDate(d.date, { weekday: 'narrow' })}</span>
                    </>
                  )
                  const cls = `wk-bar${w ? ` k-${w.kind}` : ''}${d.allDone ? ' done' : ''}${d.isToday ? ' is-today' : ''}`
                  return (
                    <li key={d.date}>
                      {w ? (
                        <button className={cls} onClick={() => onOpen(w.id)} aria-label={say} title={say}>
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
            </section>
          )}

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
    </div>
  )
}
