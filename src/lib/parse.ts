import { parseClock } from './pace'

// The plan is written as plain text, one line per day:
//
//   Week 1
//   Mon: Rest
//   Tue: Easy 10k + Strength A
//   Wed: Workout "Threshold repeats": 3k @easy, 5x(1.6k @103-106%, 400m @easy), 3k @easy
//   Sun: Long 24k
//
// Paces: @easy, @MP, a % of marathon pace (@95-100%), a % of 5K pace (@90-92% 5k), or a set pace (@4:30-4:40).
// Steps with no pace to hit: @feel, @walk, @strides, @progression.

export type Target =
  | { t: 'easy' }
  | { t: 'mp'; lo: number; hi: number } // % of marathon speed
  | { t: '5k'; lo: number; hi: number } // % of 5K speed
  | { t: 'pace'; lo: number; hi: number } // sec/km, lo = fastest
  | { t: 'none'; label?: string }

// Words for a step run without a target pace → what the step is called on screen.
const UNPACED: Record<string, string | undefined> = { feel: undefined, walk: 'Walk', strides: 'Strides', progression: 'Progression' }

export interface Step {
  km?: number
  sec?: number
  target: Target
}

export interface Block {
  reps: number
  steps: Step[]
}

export type Kind = 'easy' | 'long' | 'quality' | 'race' | 'strength'

export interface Item {
  kind: Kind
  title: string
  src: string
  blocks: Block[]
  routine?: string
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const KINDS: Record<string, { kind: Kind; title: string; fallback: Target }> = {
  easy: { kind: 'easy', title: 'Easy run', fallback: { t: 'easy' } },
  long: { kind: 'long', title: 'Long run', fallback: { t: 'easy' } },
  workout: { kind: 'quality', title: 'Workout', fallback: { t: 'none' } },
  race: { kind: 'race', title: 'Race', fallback: { t: 'mp', lo: 100, hi: 100 } },
}

/** Split on a separator, ignoring any inside brackets or quotes. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let quoted = false
  let cur = ''
  for (const c of s) {
    if (c === '"') quoted = !quoted
    else if (!quoted && c === '(') depth++
    else if (!quoted && c === ')') depth--
    if (c === sep && !quoted && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

function parseTarget(s: string): Target {
  const v = s.trim().toLowerCase().replace(/\s*\/km$/, '')
  if (v === 'easy') return { t: 'easy' }
  if (v === 'mp') return { t: 'mp', lo: 100, hi: 100 }
  if (v in UNPACED) return UNPACED[v] ? { t: 'none', label: UNPACED[v] } : { t: 'none' }
  let m = v.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*%\s*(mp|5k)?$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2] ?? m[1])
    return { t: m[3] === '5k' ? '5k' : 'mp', lo: Math.min(a, b), hi: Math.max(a, b) }
  }
  m = v.match(/^(\d+:\d{2})(?:\s*-\s*(\d+:\d{2}))?$/)
  if (m) {
    const a = parseClock(m[1])!
    const b = parseClock(m[2] ?? m[1])!
    return { t: 'pace', lo: Math.min(a, b), hi: Math.max(a, b) }
  }
  throw new Error(`Can't read the pace "${s.trim()}". Use easy, MP, a percentage like 95-100% or 90% 5k, or a pace like 4:30-4:40.`)
}

function parseStep(s: string, fallback: Target): Step {
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(km|k|min|m|sec|s)\s*(?:@\s*(.+))?$/i)
  if (!m) throw new Error(`Can't read the step "${s}". Write a distance or time, then an optional pace, like 1k @95%.`)
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const target = m[3] ? parseTarget(m[3]) : fallback
  if (unit === 'km' || unit === 'k') return { km: n, target }
  if (unit === 'm') return { km: n / 1000, target }
  return { sec: unit === 'min' ? n * 60 : n, target }
}

/** One workout from its text. Returns null for a rest day; throws with a readable message on bad input. */
export function parseItem(src: string): Item | null {
  const text = src.trim()
  if (/^rest$/i.test(text)) return null

  const strength = text.match(/^strength\b\s*(.*)$/i)
  if (strength) {
    const routine = strength[1].trim() || 'A'
    return { kind: 'strength', title: `Strength ${routine}`, src: text, blocks: [], routine }
  }

  const head = text.match(/^(easy|long|workout|race)\b\s*(?:"([^"]*)"\s*:?)?\s*(.*)$/i)
  if (!head) throw new Error(`"${text}" should start with Rest, Easy, Long, Workout, Race or Strength.`)
  const def = KINDS[head[1].toLowerCase()]
  const parts = splitTop(head[3], ',')
  if (!parts.length) throw new Error(`"${text}" needs a distance or time, like ${head[1]} 10k.`)

  const blocks = parts.map((part): Block => {
    const rep = part.match(/^(\d+)\s*x\s*\((.*)\)$/i)
    if (rep) return { reps: Number(rep[1]), steps: splitTop(rep[2], ',').map((s) => parseStep(s, def.fallback)) }
    return { reps: 1, steps: [parseStep(part, def.fallback)] }
  })
  return { kind: def.kind, title: head[2]?.trim() || def.title, src: text, blocks }
}

export interface PlanError {
  line: number
  msg: string
}

/** Whole plan → weeks[week][day 0-6 from Monday] = workouts. */
export function parsePlan(text: string): { weeks: Item[][][]; errors: PlanError[] } {
  const weeks: Item[][][] = []
  const errors: PlanError[] = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    if (/^week\b/i.test(line)) {
      weeks.push(DAYS.map(() => []))
      return
    }
    const day = line.match(/^([a-z]{3})[a-z]*\s*:\s*(.*)$/i)
    const di = day ? DAYS.indexOf(day[1].toLowerCase()) : -1
    if (!day || di < 0) {
      errors.push({ line: i + 1, msg: `"${line}" should be "Week 1" or a day like "Mon: Easy 10k".` })
      return
    }
    if (!weeks.length) {
      errors.push({ line: i + 1, msg: 'Start with a "Week 1" line before the first day.' })
      return
    }
    try {
      for (const part of splitTop(day[2], '+')) {
        const item = parseItem(part)
        if (item) weeks[weeks.length - 1][di].push(item)
      }
    } catch (e) {
      errors.push({ line: i + 1, msg: (e as Error).message })
    }
  })
  return { weeks, errors }
}
