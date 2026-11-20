// Throwaway prototype variant: "Notebook". The page speaks in sentences, like a training log kept by hand.
import { fmtCountdown, fmtDate, daysBetween } from './snapshot/src/lib/dates'
import { fmtClock, fmtKm, targetPaces } from './snapshot/src/lib/pace'
import type { Workout } from './snapshot/src/lib/store'
import { heatOf, KindTag, Steps } from './snapshot/src/Steps'
import { kmOf, useDay } from './data'
import type { TodayProps } from './Shell'

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty']
/** Whole distances up to twenty are written as words, the way a sentence would have them. */
const say = (km: number) => {
  const r = Math.round(km * 10) / 10
  return Number.isInteger(r) && r <= 20 ? WORDS[r] : fmtKm(r)
}

/** A pencil tick, drawn slightly off true. */
function Tick() {
  return (
    <svg className="nb-tick" width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      <path d="M1.5 7.6c1.3 1.2 2.4 2.6 3.4 4.3C7.3 7.4 10.300 4 14.600 1.300" fill="none" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A pencil ring around today, not quite closed. */
function Ring() {
  return (
    <svg className="nb-ring" viewBox="0 0 44 26" preserveAspectRatio="none" aria-hidden="true">
      <path d="M30 2.600C19 0.500 5 3.500 2.600 11.500 0.600 19 10 24.300 22.500 23.800 34 23.300 42.500 18.500 41.600 11.500 41 6.500 34.500 2.800 25.500 3.200" fill="none" strokeWidth="1.500" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Notebook({ onOpen, onSetup }: TodayProps) {
  const { now, settings, days, todays, next, weekPlanned, weekDone, weeks, weekNo, hasPlan } = useDay()
  const toRace = daysBetween(now, settings.raceDate)
  const main = todays.find((w) => w.kind !== 'strength') ?? todays[0]
  const nextUp = todays.find((w) => !w.done)?.id

  let headline = 'Rest day.'
  let lede = next[0] ? `Nothing planned today. Next is ${next[0].title} on ${fmtDate(next[0].date, { weekday: 'long' })}.` : 'Nothing planned today.'
  if (!hasPlan) {
    headline = 'No plan yet.'
    lede = 'Lay one onto the calendar and today’s workout will be written up here.'
  } else if (main) {
    const km = kmOf(main, settings)
    const heat = heatOf(main)
    const easy = targetPaces({ t: 'easy' }, settings, heat)!
    const between = `Keep it between ${fmtClock(easy[0])} and ${fmtClock(easy[1])} a kilometre.`
    if (main.done) {
      headline = main.kind === 'strength' ? `${main.title}, done.` : `Done. ${fmtKm(main.done.km)} km${main.done.sec ? ` in ${fmtClock(main.done.sec)}` : ''}.`
      lede = main.kind === 'strength' ? 'That’s today written up.' : `${main.title}, written up. ${main.done.sec && main.done.km ? `It averaged ${fmtClock(main.done.sec / main.done.km)} a kilometre.` : ''}`
    } else if (main.kind === 'easy') {
      headline = `${say(km)} easy ${km === 1 ? 'kilometre' : 'kilometres'}.`
      lede = between
    } else if (main.kind === 'long') {
      headline = `${say(km)} kilometres, the long one.`
      lede = main.blocks.length === 1 ? between : `${main.title}. The paces are below.`
    } else if (main.kind === 'quality') {
      headline = `${main.title}.`
      lede = `${fmtKm(km)} km in all, warm-up to cool-down.`
    } else if (main.kind === 'race') {
      headline = 'Race day.'
      lede = `${settings.raceName}. ${fmtKm(km)} km${settings.goalTime ? `, and ${settings.goalTime} to aim at` : ''}.`
    } else {
      headline = `${main.title}.`
      lede = 'No running today, only the strength work.'
    }
    if (heat > 0 && !main.done) lede += ` Paces are slowed ${heat.toFixed(1)}% for the heat.`
  }

  const entry = (w: Workout) => (
    <section key={w.id} className={`nb-entry k-${w.kind}`}>
      <div className="nb-entry-head">
        <KindTag kind={w.kind} />
        {/* The headline already names the main workout when it is a quality session. */}
        {!(w === main && (w.kind === 'quality' || w.kind === 'strength') && !w.done) && <h2>{w.title}</h2>}
        {w.kind !== 'strength' && (
          <span className="nb-km">
            {fmtKm(kmOf(w, settings))}
            <small> km</small>
          </span>
        )}
      </div>
      <Steps w={w} />
      <button className={`btn${w.id === nextUp ? ' primary' : ''}`} onClick={() => onOpen(w.id)}>
        {w.done ? 'See how it went' : 'Open workout'}
      </button>
    </section>
  )

  return (
    <div className="nb">
      <header className="nb-head">
        <p className="nb-over">
          <span>{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          {weekNo > 0 && (
            <span>
              Week {weekNo} of {weeks.length}
            </span>
          )}
          {hasPlan && <span>{toRace > 0 ? `${fmtCountdown(toRace)} to ${settings.raceName}` : toRace === 0 ? `${settings.raceName} is today` : `${settings.raceName} is done`}</span>}
        </p>
        <h1>{headline}</h1>
        <p className="nb-lede">{lede}</p>
        {!hasPlan && (
          <button className="btn primary" onClick={onSetup}>
            Go to Setup
          </button>
        )}
      </header>

      <div className="nb-grid">
        <div className="nb-main">{todays.map(entry)}</div>

        {hasPlan && (
          <aside className="nb-side">
            <section>
              <h2 className="nb-label">This week</h2>
              <ol className="nb-week">
                {days.map((d) => {
                  const w = d.main
                  const label = (
                    <>
                      <span className="nb-day">
                        {fmtDate(d.date, { weekday: 'short' })}
                        {d.isToday && <Ring />}
                        {d.isToday && <span className="sr-only"> (today)</span>}
                      </span>
                      <span className="row-title">{w ? d.items.map((x) => x.title).join(' + ') : 'Rest'}</span>
                      {d.km > 0 && <span className="nb-row-km">{fmtKm(d.km)}</span>}
                      <span className="nb-mark">
                        {d.allDone && <Tick />}
                        {d.allDone && <span className="sr-only">Done</span>}
                      </span>
                    </>
                  )
                  return (
                    <li key={d.date}>
                      {w ? (
                        <button className="row-btn" onClick={() => onOpen(w.id)}>
                          {label}
                        </button>
                      ) : (
                        <div className="row-btn nb-rest">{label}</div>
                      )}
                    </li>
                  )
                })}
              </ol>
              <p className="nb-total">
                <b>{fmtKm(weekDone)}</b> of {fmtKm(weekPlanned)}&nbsp;km run
              </p>
            </section>

            {next.length > 0 && next[0].date > days[6].date && (
              <section>
                <h2 className="nb-label">Next week opens with</h2>
                <button className={`row-btn k-${next[0].kind}`} onClick={() => onOpen(next[0].id)}>
                  <span className="nb-day">{fmtDate(next[0].date, { weekday: 'short' })}</span>
                  <span className="row-title">{next[0].title}</span>
                </button>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
