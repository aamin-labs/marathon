import { useEffect, useRef, useState } from 'react'
import { DAYS_AHEAD, fetchCompleted, removeSent, sendToIntervals } from './lib/intervals'

/** Sends the coming runs to intervals.icu, fetches completed ones back, and reports what happened. `withRemove` adds the undo for sending. */
export function SendButton({ withRemove = false }: { withRemove?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  // Removing reaches into intervals.icu, where this app can't undo it, so it takes a second press.
  const [confirming, setConfirming] = useState(false)
  const askedAt = useRef(0)
  const failed = msg != null && !msg.ok

  // The second press has to come soon, or the button goes back to asking.
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 5000)
    return () => clearTimeout(timer)
  }, [confirming])

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setMsg(null)
    try {
      setMsg({ text: await action(), ok: true })
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="send">
      <div className="btn-row">
        <button className="btn" onClick={() => run(sendToIntervals)} disabled={busy}>
          Send next {DAYS_AHEAD} days to watch
        </button>
        <button className="btn" onClick={() => run(fetchCompleted)} disabled={busy}>
          Fetch completed runs
        </button>
        {withRemove && (
          <button
            className="btn danger"
            onClick={() => {
              if (!confirming) {
                askedAt.current = Date.now()
                return setConfirming(true)
              }
              // A double-click isn't a considered second press.
              if (Date.now() - askedAt.current < 600) return
              setConfirming(false)
              run(removeSent)
            }}
            onBlur={() => setConfirming(false)}
            disabled={busy}
          >
            {confirming ? 'Press again to remove' : 'Remove sent runs'}
          </button>
        )}
      </div>
      <p className={`status-line ${failed ? 'error' : 'muted'}`} role={failed ? 'alert' : 'status'}>
        {busy ? 'Working…' : msg?.text}
      </p>
    </div>
  )
}
