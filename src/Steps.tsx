import { fmtClock, fmtKm, heatSlowdown, targetPaces } from './lib/pace'
import type { Kind, Step, Target } from './lib/parse'
import { useStore, type Workout } from './lib/store'
import { isRun } from './lib/workout'

function amount(step: Step): string {
  if (step.km != null) return step.km < 1 ? `${Math.round(step.km * 1000)}\u00A0m` : `${fmtKm(step.km)}\u00A0km`
  const sec = step.sec ?? 0
  return sec % 60 === 0 ? `${sec / 60}\u00A0min` : `${sec}\u00A0s`
}

function targetLabel(t: Target): string {
  if (t.t === 'easy') return 'Easy'
  if (t.t === 'none') return t.label ?? 'By feel'
  if (t.t === 'pace') return 'Set pace'
  if (t.t === 'mp' && t.lo === 100 && t.hi === 100) return 'Marathon pace'
  const of = t.t === '5k' ? '5K pace' : 'marathon pace'
  return t.lo === t.hi ? `${t.lo}% of ${of}` : `${t.lo}–${t.hi}% of ${of}`
}

const KIND_NAMES: Record<Kind, string> = { easy: 'Easy', long: 'Long run', quality: 'Quality', race: 'Race', strength: 'Strength' }

/** A small label naming the kind of session, in that kind's colour. */
export function KindTag({ kind }: { kind: Kind }) {
  return (
    <span className={`kind k-${kind}`}>
      <span className="dot" />
      {KIND_NAMES[kind]}
    </span>
  )
}

export const heatOf = (w: Workout) => (w.heat ? heatSlowdown(w.heat.tempC, w.heat.dewC) : 0)

/** The workout's steps with the paces to run them at, slowed for heat when conditions are set. */
export function Steps({ w }: { w: Workout }) {
  const settings = useStore((s) => s.settings)
  const routines = useStore((s) => s.routines)
  const heat = heatOf(w)

  if (!isRun(w)) {
    const routine = routines.find((r) => r.name.toLowerCase() === w.routine?.toLowerCase())
    if (!routine) return <p className="muted">No routine called “{w.routine}” yet. Add its exercises in Setup.</p>
    return (
      <ul className="exercises">
        {routine.text.split('\n').filter((l) => l.trim()).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    )
  }

  const row = (step: Step, key: number) => {
    const paces = targetPaces(step.target, settings, heat)
    return (
      <li className="step" key={key}>
        <span className="step-amount">{amount(step)}</span>
        <span className="step-target">{targetLabel(step.target)}</span>
        <span className="step-pace">
          {paces ? (paces[0] === paces[1] ? fmtClock(paces[0]) : `${fmtClock(paces[0])}–${fmtClock(paces[1])}`) : ''}
          {paces && <small> /km</small>}
        </span>
      </li>
    )
  }

  return (
    <ol className="steps">
      {w.blocks.map((b, i) =>
        b.reps === 1 ? (
          row(b.steps[0], i)
        ) : (
          <li className="repeat" key={i}>
            <span className="repeat-count">{b.reps} times</span>
            <ol className="steps">{b.steps.map(row)}</ol>
          </li>
        ),
      )}
    </ol>
  )
}
