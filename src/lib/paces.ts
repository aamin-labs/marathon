import { slowdown } from './conditions'
import { parseClock, type PaceSettings } from './pace'
import type { Step, Target } from './parse'
import type { Workout } from './store'

// What pace each step of a workout is run at. Screens and the watch text ask here, and only decide how to write the answer down.

const MARATHON_KM = 42.195

/** [fastest, slowest] pace in sec/km. */
export type PaceRange = [number, number]

/** A planned step with the paces to run it at: null when there is no pace, as for a step run by feel. */
export interface StepWithPaces extends Step {
  paces: PaceRange | null
}

export interface BlockWithPaces {
  reps: number
  steps: StepWithPaces[]
}

/** Marathon pace in seconds per km. */
function mpPace(goalTime: string): number {
  return (parseClock(goalTime) ?? 12600) / MARATHON_KM
}

/** 5K pace in seconds per km. With no 5K time set, assume marathon speed is 81% of 5K speed, the plan book's default conversion. */
function fiveKPace(s: PaceSettings): number {
  const t = parseClock(s.fiveK ?? '')
  return t ? t / 5 : mpPace(s.goalTime) * 0.81
}

// Percentages are of *speed*, so 105% MP is faster than marathon pace.
const pctToPace = (base: number, pct: number) => base / (pct / 100)

/**
 * The calculation behind every answer here: one target, the settings and a percent to slow down → a pace range.
 * Exported only for the sheet's comparison of a result with its target, until that comparison moves into this module.
 */
export function targetPaces(target: Target, s: PaceSettings, heatPct = 0): PaceRange | null {
  const mp = mpPace(s.goalTime)
  let range: PaceRange
  if (target.t === 'easy') range = [pctToPace(mp, s.easyHi), pctToPace(mp, s.easyLo)]
  else if (target.t === 'mp') range = [pctToPace(mp, target.hi), pctToPace(mp, target.lo)]
  else if (target.t === '5k') range = [pctToPace(fiveKPace(s), target.hi), pctToPace(fiveKPace(s), target.lo)]
  else if (target.t === 'pace') range = [target.lo, target.hi]
  else return null
  const k = 1 + heatPct / 100
  return [range[0] * k, range[1] * k]
}

/** The workout's repeats and steps as planned, each step with its paces, already slowed for the workout's conditions. */
export function stepsWithPaces(w: Pick<Workout, 'blocks' | 'heat'>, s: PaceSettings): BlockWithPaces[] {
  const heat = slowdown(w)
  return w.blocks.map((b) => ({ reps: b.reps, steps: b.steps.map((step) => ({ ...step, paces: targetPaces(step.target, s, heat) })) }))
}

export interface TrainingPaces {
  /** Marathon pace in sec/km. */
  marathon: number
  easy: PaceRange
  /** 5K pace in sec/km. */
  fiveK: number
  /** True while no 5K time is entered, so the 5K pace comes from the goal time. A 5K time that can't be read is Setup's to report. */
  fiveKEstimated: boolean
}

/** The paces the settings come to, before any workout or its conditions. */
export function trainingPaces(s: PaceSettings): TrainingPaces {
  return { marathon: mpPace(s.goalTime), easy: targetPaces({ t: 'easy' }, s)!, fiveK: fiveKPace(s), fiveKEstimated: !s.fiveK?.trim() }
}
