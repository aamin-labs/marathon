import { useState } from 'react'
import { DAYS_AHEAD, fetchCompleted, removeSent, sendToIntervals } from './lib/intervals'

/** Sends the coming runs to intervals.icu, fetches completed ones back, and reports what happened. `withRemove` adds the undo for sending. */
export function SendButton({ withRemove = false }: { withRemove?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

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
          <button className="btn danger" onClick={() => run(removeSent)} disabled={busy}>
            Remove sent runs
          </button>
        )}
      </div>
      {busy && <p className="muted">Working…</p>}
      {msg && (
        <p className={msg.ok ? 'muted' : 'error'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
