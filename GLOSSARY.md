# Marathon

A personal app for following a self-written marathon training plan: what to run each day, at what pace, and how it went.

## Language

### Workouts

**Workout**:
One planned session on one day: a run, a race, or a strength session.
_Avoid_: Activity, session

**Done**:
A workout that was carried out and has a result recorded against it.
_Avoid_: Completed, logged

**Skipped**:
A workout that was deliberately not carried out. It stays on the calendar and counts as missed.
_Avoid_: Missed, cancelled

**Removed**:
A workout taken off the calendar as though it was never planned. It leaves no record and does not count as missed.
_Avoid_: Deleted

**Race**:
A workout that is a timed event, with a distance and an optional goal time. Adding one does not change training paces.

**Goal race**:
The race the plan builds towards, on the plan's last day. Its goal time sets every training pace.
_Avoid_: A race, target race

**B race**:
Any race other than the goal race, run during the plan.
_Avoid_: Tune-up race

**Treadmill run**:
A run done indoors on a treadmill, shown as speeds in km/h instead of paces, with no heat adjustment.
_Avoid_: Indoor run

### Plans

**Plan**:
A named training programme: its goal race, goal time, the written weeks of workouts, and the workouts laid out on the calendar.
_Avoid_: Schedule, programme

**Current plan**:
The one plan being followed now. There is never more than one.
_Avoid_: Active plan

**Long run day**:
The weekday the runner prefers for the week's long run. It is applied once, when a plan is laid onto the calendar.

**Time off**:
A marked stretch of dates, with a reason of holiday or illness, during which training is not expected.
_Avoid_: Break, unavailable period

**Plan progress**:
Distance run so far as a share of the plan's total planned distance. Skipped workouts count as not run.
_Avoid_: Completion, adherence

**Previous plan**:
A plan that has been finished or replaced, kept as a read-only record of its goal race, what was planned and what was done.
_Avoid_: Archived plan, old plan
