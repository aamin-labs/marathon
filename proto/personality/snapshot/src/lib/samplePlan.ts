// A generic 18-week placeholder so the app isn't empty on first run.
// It is NOT a Marathon Excellence plan: replace it in Setup with the plan from your book.

const LONG = [20, 22, 24, 20, 24, 26, 28, 22, 28, 30, 32, 24, 30, 32, 34, 28, 22]
const EASY = [9, 10, 10, 8, 11, 11, 12, 9, 12, 13, 13, 10, 13, 14, 14, 11, 8]

const WORKOUTS = [
  (w: number) => `Workout "Threshold repeats": 3k @easy, ${4 + Math.floor(w / 6)}x(1.6k @103-106%, 400m @easy), 3k @easy`,
  (w: number) => `Workout "Marathon pace": 3k @easy, ${8 + Math.floor(w / 3) * 2}k @98-102%, 2k @easy`,
  (w: number) => `Workout "10K reps": 3k @easy, ${5 + Math.floor(w / 6)}x(1k @108-112%, 2min @easy), 3k @easy`,
]

export function samplePlan(): string {
  const out = ['# Sample plan. Replace it with your own.', '']
  LONG.forEach((long, w) => {
    const e = EASY[w]
    out.push(
      `Week ${w + 1}`,
      'Mon: Rest',
      `Tue: Easy ${e}k + Strength A`,
      `Wed: ${WORKOUTS[w % 3](w)}`,
      `Thu: Easy ${e}k`,
      `Fri: Easy ${Math.round(e * 0.7)}k + Strength B`,
      `Sat: Easy ${e}k`,
      `Sun: Long ${long}k`,
      '',
    )
  })
  out.push(
    'Week 18',
    'Mon: Rest',
    'Tue: Easy 8k',
    'Wed: Workout "Race tune-up": 3k @easy, 3x(1.6k @MP, 400m @easy), 2k @easy',
    'Thu: Easy 6k',
    'Fri: Rest',
    'Sat: Easy 4k',
    'Sun: Race 42.195k @MP',
  )
  return out.join('\n')
}

export const SAMPLE_ROUTINES = [
  {
    name: 'A',
    text: 'Split squat, 3 x 8 each side\nSingle-leg Romanian deadlift, 3 x 8 each side\nCalf raise, 3 x 12 each side\nStep-up, 3 x 10 each side\nPlank, 3 x 45 s',
  },
  {
    name: 'B',
    text: 'Glute bridge, 3 x 12\nSide plank, 3 x 30 s each side\nCopenhagen plank, 3 x 20 s each side\nDead bug, 3 x 10 each side\nBanded lateral walk, 3 x 12 steps each way',
  },
]
