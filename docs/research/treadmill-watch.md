# What should the watch receive for a treadmill run?

Research for [issue #3](https://github.com/aamin-labs/marathon/issues/3). Researched 2026-11-13.

The chain in question: this app → intervals.icu calendar → Intervals Companion (iPhone) → Apple's Workout app on the watch.

## Short answer

Send a treadmill run almost exactly like an outdoor run:

- Keep `type: "Run"`. Add `indoor: true` to the event.
- Keep writing each step as a **pace** (`4:48/km Pace`). intervals.icu's workout text has no km/h target for runs. The km/h figure is something this app shows on its own screen; it is the same target, converted (`km/h = 60 ÷ pace in min/km`).
- On the watch, the choice between indoor and outdoor is most likely made by the runner when starting the workout, not by what we send. Apple changed this in watchOS 10.1.
- Pace alerts on an indoor run need watchOS 11 or later. The watch judges treadmill pace from arm movement, so it will not agree exactly with the treadmill's display.

Nothing in the published sources says how Intervals Companion treats an indoor run. That part needs one hands-on test (listed at the end).

## 1. Which intervals.icu type means a treadmill run?

**Verified**

- intervals.icu has no `Treadmill` type. The run-like values in its list of activity types are `Run`, `TrailRun` and `VirtualRun`. Source: the type list in the OpenAPI document, <https://intervals.icu/api/v1/docs> (for example under `SportSettings.types`; human-readable version at <https://intervals.icu/api-docs.html>).
- A calendar event has a separate yes/no field called `indoor`, next to `type`. Source: the `Event` and `EventEx` schemas in the same document. `EventEx` is what `POST /api/v1/athlete/{id}/events/bulk` accepts.
- The event's `type` field is declared as free text, not restricted to the list. So the document does not, on its own, prove which values a calendar event accepts or rejects.
- intervals.icu itself treats a planned `Run` as something that may be done on a treadmill. When it sends planned workouts to Suunto, the developer's mapping is `case Run: return List.of(running, trail_running, treadmill, trekking, track_running)`, and he describes the aim as not blocking people from doing a workout indoors. Source: david, <https://forum.intervals.icu/t/planned-workouts-not-supported-on-suunto-run/132828/10>.
- Recorded activities carry a `trainer` yes/no field rather than `indoor`. Source: the `Activity` schema.

**Inferred**

- `VirtualRun` is the closest type to "treadmill", and `indoor: true` is the intended way to mark a planned workout as indoor. The API document gives neither field a description, so this reading rests on the names and on how Strava (whose type names intervals.icu reuses) uses `VirtualRun`.
- `Run` plus `indoor: true` is the safer thing to send than `VirtualRun`. `Run` is the type already proven to work through Companion to the watch. `VirtualRun` is unproven on that path, and one forum user found that planned "virtual" types were not matched properly by another watch brand (Coros): <https://forum.intervals.icu/t/recommendations-for-coros-activity-mapping/125389>.

**Not determined**

- Whether the events endpoint accepts `type: "VirtualRun"` and `indoor: true` in practice. I did not have the API key, so nothing was sent.

## 2. Does the workout text accept speed (km/h) for runs?

**Verified**

- No speed target is documented. The syntax guide lists three target families: power, heart rate and pace. Pace is written as time per distance (`5:00/km Pace`, also `/mi`, `/100m`, `/400m` and others), as a percentage of threshold pace, or as a pace zone. Source: <https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701>.
- A user asked in November 2025 for "a conversion from pace to km/h in the workout builder ... for using on the treadmill". There is no reply. Source: <https://forum.intervals.icu/t/workout-builder/1163/1065>. An older request for km/h targets (2021) is at <https://forum.intervals.icu/t/workout-builder/1163/360>.
- The event's `target` field only allows `AUTO`, `POWER`, `HR` or `PACE`. Source: OpenAPI document.

**Inferred**

- An indoor run's targets are best written exactly as now: absolute pace ranges per km. A speed of 12.5 km/h is the pace 4:48/km, so nothing is lost.
- Writing the km/h figure into the step's label text is risky. The guide says "any text before the first duration becomes the cue text", and a label such as `12.5km/h` contains something that looks like a distance (`12.5km`). It could be read as a 12.5 km step. If the speed should appear on the watch, that needs its own test, and the step label on the watch depends on Companion passing it through.

## 3. What do Intervals Companion and the watch do with it?

### Apple's side

**Verified**

- A WorkoutKit custom workout is created with an activity and a location: `init(activity:location:displayName:warmup:blocks:cooldown:)`, where location is indoor, outdoor or unknown, and unknown is the default. Source: <https://developer.apple.com/documentation/workoutkit/customworkout/init(activity:location:displayname:warmup:blocks:cooldown:)>.
- Since watchOS 10.1 an app no longer has to choose: "you no longer need to specify between indoor and outdoor location types when scheduling workouts", "leaving the user to decide". Source: Apple, WWDC24 session 10084, <https://developer.apple.com/videos/play/wwdc2024/10084/>.
- Pace alerts on indoor runs exist from watchOS 11: "new for indoor running, watchOS 11 now supports pace alerts". Same session. Before that, indoor runs showed no pace target at all, as DC Rainmaker found in December 2023 with TrainingPeaks workouts ("Apple doesn't show pace targets indoors"; he also notes the watch "will ask you to confirm if it's an Indoor or Outdoor workout"): <https://dcrainmaker.com/2023/12/training-integration-applewatch.html>.
- Pace is sent to the watch as a speed range (`SpeedRangeAlert`), judged on either current or average value. Whether a given alert is allowed for an activity and location is something an app asks the system (`supportsAlert(_:activity:location:)`); Apple publishes no table. Sources: <https://developer.apple.com/documentation/workoutkit/speedrangealert>, <https://developer.apple.com/documentation/workoutkit/customworkout/supportsalert(_:activity:location:)>.
- The watch learns stride length to estimate pace and distance without GPS: it "continues to calibrate the accelerometer by learning your stride length at different speeds". Source: <https://support.apple.com/en-us/105048>.

**Inferred**

- On an indoor run the watch's pace is an estimate from arm swing, so it can differ from the treadmill belt speed. A pace alert may therefore fire while the treadmill is set exactly to target. Treat alerts on a treadmill as a rough guide and the treadmill's own display as the truth.
- The Workout app shows runs as pace. I found nothing saying it can show km/h for a run, so "steps as km/h on the watch" should not be assumed.

### Intervals Companion's side

**Verified**

- Companion turns pace targets into `SpeedRangeAlert`s. The developer: "For pace, SpeedrangeAlert is what's used." Absolute `/km` paces were fixed in March 2026. Source: <https://forum.intervals.icu/t/intervals-companion-v3-updates-for-apple-health-and-workout-syncing/124208/16> and post 18 in the same thread.
- Alerts use current pace by default. There is a Companion setting for average pace (workouts → settings). Switching alerts off entirely is not available; the developer called it a "good idea". Source: <https://forum.intervals.icu/t/intervals-companion-v4-updates/133092/17>.
- Companion v4 can filter which activity types are synced to the watch ("Apple Watch sync can be filtered by activity type"). Source: <https://forum.intervals.icu/t/intervals-companion-v4-updates/133092>.
- A watch workout recorded while paired to a gym treadmill (GymKit, tap-to-pair) is stored in Apple Health as coming from the treadmill, not the watch. With Companion's "Apple Watch only" filter on, it is not uploaded to intervals.icu. The developer confirmed this on 2026-11-10 and plans a manual sync button. Source: <https://forum.intervals.icu/t/intervals-companion-v4-updates/133092/24> (report in post 23).

**Not determined**

I read the Companion v3 thread (187 posts), the v4 thread (26 posts) and searched the original Companion thread and the wider forum. None of them says:

- whether Companion reads the event's `indoor` field or the `VirtualRun` type;
- whether it creates the watch workout as indoor, outdoor or unspecified;
- whether a `VirtualRun` event is converted at all.

Companion's source code is not public, so only a test can answer these.

## What to send: recommendation

| Field | Outdoor run (today) | Treadmill run |
| --- | --- | --- |
| `category` | `WORKOUT` | `WORKOUT` |
| `type` | `Run` | `Run` |
| `indoor` | not sent | `true` |
| `description` | pace per step, heat-adjusted | pace per step, no heat adjustment |

Why this and not `VirtualRun`: it changes one harmless, documented field on a chain that already works, and Apple leaves the indoor/outdoor choice to the runner at the start of the workout. `VirtualRun` gains nothing we can confirm and could stop the workout reaching the watch.

One existing detail in `src/lib/intervals.ts` already copes with either outcome when runs are read back: completed activities are kept if their type contains "run", which covers `Run` and `VirtualRun`.

## Hands-on tests for the owner

These are the things no source could settle. Each takes one treadmill session or less.

1. **Does the watch offer an indoor run?** Send one run with `indoor: true`, sync with Companion, open it in the Workout app. Note whether it asks indoor or outdoor, starts as Indoor Run by itself, or only starts outdoors (GPS on).
2. **Do pace alerts work indoors?** During that run, note whether the target pace range is shown and whether alerts fire, and how far the watch's pace is from the treadmill's display. Needs watchOS 11 or later.
3. **Does intervals.icu accept the event?** Check that the send succeeds and the calendar entry shows as indoor. If step 1 fails, repeat once with `type: "VirtualRun"` to see whether Companion handles it differently.
4. **How does the finished run come back?** After the run syncs to intervals.icu, check its type (`Run` or `VirtualRun`), whether it has a distance, and whether it has laps per step. This decides whether a treadmill run can be compared with its targets. Do not pair the watch to the treadmill by tapping it (GymKit), or Companion may skip the upload.
