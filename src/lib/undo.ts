import { create } from 'zustand'
import { exportData, useStore, type Data } from './store'

/** The one change that can still be taken back, with the data as it was before it. Not saved: it is gone after a reload. */
export const useUndo = create<{ pending: { label: string; before: Data } | null }>(() => ({ pending: null }))

export function dismissUndo() {
  useUndo.setState({ pending: null })
}

// Undo puts back everything as it was, so it is only safe while nothing else has changed since. Any later change withdraws the offer.
useStore.subscribe(dismissUndo)

/** Make a destructive change and offer to take it back. Offers nothing when the change did nothing. */
export function withUndo<T>(label: string, change: () => T): T {
  const before = exportData()
  const result = change()
  if (JSON.stringify(exportData()) !== JSON.stringify(before)) useUndo.setState({ pending: { label, before } })
  return result
}

export function undo() {
  const { pending } = useUndo.getState()
  if (pending) useStore.getState().replaceAll(pending.before)
}
