import { useState } from 'react'
import { isPlausibleDate } from './lib/dates'
import { parseNumber, type NumberLimits } from './lib/number'

// Both fields keep what was typed as their own text and save only once it is a complete, valid value.
// Saving every keystroke straight into the setting would rewrite half-typed input under the cursor: "25." back to "25", a year back to the old one.

/** A field for a number setting. `allowEmpty` lets it be cleared to no value, saved as null. */
export function NumberField({
  value,
  onSave,
  allowEmpty = false,
  inputMode = 'decimal',
  ...limits
}: { value: number | null; onSave: (n: number | null) => void; allowEmpty?: boolean; inputMode?: 'decimal' | 'numeric' } & NumberLimits) {
  const toText = (n: number | null) => (n == null ? '' : String(n))
  const [text, setText] = useState(toText(value))
  const [lastValue, setLastValue] = useState(value)
  // The setting changed from outside the field (say, "Use my location"): show the new value.
  if (value !== lastValue) {
    setLastValue(value)
    if (parseNumber(text, limits) !== value) setText(toText(value))
  }
  const usable = (t: string) => parseNumber(t, limits) != null || (allowEmpty && t.trim() === '')

  return (
    <input
      inputMode={inputMode}
      value={text}
      aria-invalid={!usable(text)}
      onChange={(e) => {
        setText(e.target.value)
        if (usable(e.target.value)) onSave(parseNumber(e.target.value, limits))
      }}
      // Leaving the field with something unusable in it puts the saved value back.
      onBlur={() => !usable(text) && setText(toText(value))}
    />
  )
}

/** A date field. While a year is being typed the browser reports dates like 0002-03-14; those are held here and not saved. */
export function DateField({ value, onSave }: { value: string; onSave: (date: string) => void }) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }

  return (
    <input
      type="date"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        if (isPlausibleDate(e.target.value)) onSave(e.target.value)
      }}
      onBlur={() => setText(value)}
    />
  )
}
