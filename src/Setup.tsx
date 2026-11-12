import { useState } from 'react'
import { fiveKPace, fmtClock, mpPace, parseClock, targetPaces } from './lib/pace'
import { parsePlan, type PlanError } from './lib/parse'
import { exportData, useStore } from './lib/store'
import { SendButton } from './SendButton'

export function Setup() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const planText = useStore((s) => s.planText)
  const setPlanText = useStore((s) => s.setPlanText)
  const applyPlan = useStore((s) => s.applyPlan)
  const routines = useStore((s) => s.routines)
  const setRoutine = useStore((s) => s.setRoutine)
  const replaceAll = useStore((s) => s.replaceAll)
  const icuKey = useStore((s) => s.icuKey)
  const setIcuKey = useStore((s) => s.setIcuKey)
  const [errors, setErrors] = useState<PlanError[]>([])
  const [msg, setMsg] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const [locMsg, setLocMsg] = useState('')

  const goalOk = parseClock(settings.goalTime) != null
  const fiveKOk = !settings.fiveK?.trim() || parseClock(settings.fiveK) != null
  const easy = targetPaces({ t: 'easy' }, settings)!
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v))

  const build = () => {
    const errs = applyPlan()
    setErrors(errs)
    setMsg(errs.length ? '' : `Schedule built: ${parsePlan(planText).weeks.length} weeks ending on race day.`)
  }

  const locate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setSettings({ lat: Number(pos.coords.latitude.toFixed(3)), lon: Number(pos.coords.longitude.toFixed(3)) }),
      () => setLocMsg("Couldn't get your location. Allow location access in the browser, or type the coordinates."),
    )
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'marathon-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data.settings || !Array.isArray(data.workouts)) throw new Error()
      replaceAll(data)
      setBackupMsg('Backup restored.')
    } catch {
      setBackupMsg("That file isn't a backup from this app.")
    }
  }

  return (
    <>
      <header className="head">
        <h1>Setup</h1>
      </header>

      <section className="card">
        <h2>Race and paces</h2>
        <div className="fields">
          <label className="wide">
            Race
            <input value={settings.raceName} onChange={(e) => setSettings({ raceName: e.target.value })} />
          </label>
          <label>
            Race day
            <input type="date" value={settings.raceDate} onChange={(e) => e.target.value && setSettings({ raceDate: e.target.value })} />
          </label>
          <label>
            Goal time
            <input inputMode="numeric" value={settings.goalTime} onChange={(e) => setSettings({ goalTime: e.target.value })} aria-invalid={!goalOk} />
          </label>
          <label className="wide">
            Current 5K time
            <input inputMode="numeric" placeholder="22:30" value={settings.fiveK ?? ''} onChange={(e) => setSettings({ fiveK: e.target.value })} aria-invalid={!fiveKOk} />
          </label>
          <label>
            Easy from, % of marathon pace
            <input inputMode="decimal" value={settings.easyLo} onChange={(e) => setSettings({ easyLo: num(e.target.value) ?? 0 })} />
          </label>
          <label>
            Easy to, %
            <input inputMode="decimal" value={settings.easyHi} onChange={(e) => setSettings({ easyHi: num(e.target.value) ?? 0 })} />
          </label>
        </div>
        {goalOk ? (
          <p className="muted">
            Marathon pace {fmtClock(mpPace(settings.goalTime))} /km. Easy runs {fmtClock(easy[0])}–{fmtClock(easy[1])} /km. 5K pace {fmtClock(fiveKPace(settings))} /km
            {settings.fiveK?.trim() ? '.' : ', estimated from the goal time until you enter a 5K time.'}
          </p>
        ) : (
          <p className="error">Enter the goal time as 3:30:00.</p>
        )}
        {!fiveKOk && <p className="error">Enter the 5K time as 22:30.</p>}
        <p className="muted">Changing race day doesn't move workouts until you rebuild the schedule below.</p>
      </section>

      <section className="card">
        <h2>Plan</h2>
        <p className="muted">
          One line per day. Paces can be <code>@easy</code>, <code>@MP</code>, a percentage of marathon pace like <code>@95-100%</code>, of 5K pace like <code>@90% 5k</code>, or a set pace
          like <code>@4:30-4:40</code>. Steps with no pace to hit take <code>@feel</code>, <code>@walk</code>, <code>@strides</code> or <code>@progression</code>. Repeats go in brackets: <code>5x(1k @105%, 2min @easy)</code>. Join two sessions on one day with <code>+</code>.
        </p>
        <textarea className="plan-text" rows={16} value={planText} onChange={(e) => setPlanText(e.target.value)} spellCheck={false} aria-label="Plan" />
        {errors.length > 0 && (
          <ul className="error" role="alert">
            {errors.map((e) => (
              <li key={e.line}>
                Line {e.line}: {e.msg}
              </li>
            ))}
          </ul>
        )}
        {msg && <p aria-live="polite">{msg}</p>}
        <button className="btn primary" onClick={build}>
          Build schedule from this plan
        </button>
        <p className="muted">This replaces every workout you haven't logged, including ones you moved. Logged workouts are kept.</p>
      </section>

      <section className="card">
        <h2>Apple Watch</h2>
        <p className="muted">
          Runs go to your intervals.icu calendar, and the Intervals Companion app passes them to the watch. Find the key in intervals.icu under Settings, Developer Settings.
          It is stored in this browser only.
        </p>
        <label className="stack">
          intervals.icu API key
          <input type="password" autoComplete="off" value={icuKey} onChange={(e) => setIcuKey(e.target.value)} />
        </label>
        <SendButton withRemove />
        <p className="muted">
          Send again after moving a workout or setting the heat, so the watch gets the change. “Fetch completed runs” logs the runs intervals.icu has recorded on the days
          you planned them; runs that reach intervals.icu through Strava can't be read. “Remove sent runs” takes this app's runs back out of intervals.icu; your plan here is
          untouched.
        </p>
      </section>

      <section className="card">
        <h2>Strength routines</h2>
        <p className="muted">One exercise per line. “Strength A” in the plan uses routine A.</p>
        {routines.map((r) => (
          <label key={r.name} className="stack">
            Routine {r.name}
            <textarea rows={5} value={r.text} onChange={(e) => setRoutine(r.name, e.target.value)} />
          </label>
        ))}
      </section>

      <section className="card">
        <h2>Heat forecast</h2>
        <div className="fields">
          <label>
            Latitude
            <input inputMode="decimal" value={settings.lat ?? ''} onChange={(e) => setSettings({ lat: num(e.target.value) })} />
          </label>
          <label>
            Longitude
            <input inputMode="decimal" value={settings.lon ?? ''} onChange={(e) => setSettings({ lon: num(e.target.value) })} />
          </label>
          <label>
            Usual run hour, 0–23
            <input inputMode="numeric" value={settings.runHour} onChange={(e) => setSettings({ runHour: Math.min(23, Math.max(0, Math.round(num(e.target.value) ?? 0))) })} />
          </label>
          <button className="btn" onClick={locate}>
            Use my location
          </button>
        </div>
        {locMsg && <p className="error" role="alert">{locMsg}</p>}
      </section>

      <section className="card">
        <h2>Shoes</h2>
        <div className="fields">
          <label>
            Replace shoes at, km
            <input inputMode="numeric" value={settings.retireKm} onChange={(e) => setSettings({ retireKm: num(e.target.value) ?? 0 })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">Everything is stored in this browser only. Save a backup file before clearing browser data or switching device.</p>
        <div className="btn-row">
          <button className="btn" onClick={download}>
            Save a backup
          </button>
          <label className="btn">
            Restore a backup
            <input type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </label>
        </div>
        {backupMsg && <p aria-live="polite">{backupMsg}</p>}
      </section>
    </>
  )
}
