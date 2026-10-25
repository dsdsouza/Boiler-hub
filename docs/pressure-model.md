# Remaining-work pressure model

The gauge estimates the load of work still ahead. It does not subtract a reward for work already completed. All tunable values live in `lib/pressure/config.ts`; the server, optimistic UI, demo gauge and team assignment preview use the same engine.

## Calibrated model

Calendar defaults remain Light 0.25, Normal 1, Heavy 1.6, with attendee factor
`1 + 0.03 * min(n, 10)`, organizer factor 1.2 and proximity `1/(1+0.35*d)`.
Task sizes remain S 2, M 4, L 8; these are relative points, not hours.

```
normalUrgency(d) = min(3, (1 / max(d, 0.25))^0.475) * taper(d, 14, 2)
examPreparation(d) = 2.75 * exp(-max(d - 7, 0)/3) * taper(d, 28, 7)
E = sum(hours * eventWeight * attendees * organizer * proximity * taper(d, 7, 1))
T = sum(openTaskSize * max(normalUrgency, examPreparation))
score = round(100 * (1 - exp(-(E/8.5 + T/26))))
```

Exam preparation applies only to recognized major exam titles with a due date.
The shared title heuristic recognizes exam, midterm, final and academic test titles;
sample essays, sync tests and notification tests are excluded from test matching.
Practice problems, preparation, review and study-guide tasks keep normal deadline
weight rather than duplicating the actual exam's preparation floor.
An undated task is treated as seven days away, without invented exam preparation.
`taper(d,h,w)` is 1 through h-w, `(1+cos(pi*(d-h+w)/w))/2` in the final w days,
and 0 at/after h. Source titles remain effort guesses that owners can resize.

Overdue work keeps its own at-deadline urgency for seven days, then approaches
urgency 0.5 with a seven-day exponential time constant. Exam and assignment peaks
match their due-time values, so crossing the deadline or fourteen-day age does not
create a score cliff. Overdue work is never silently completed.

For backward-compatible additive raw units, `taskPoints` returns
`size * urgency * 8.5/26`; `scoreFromRaw` and its inverse keep K=8.5.
Forecasts, owner explanations, optimistic edits, team previews and assignment posts
all use these helpers, including the assignment title for exam recognition.

The selected conservative weights came from a bounded simulation search across
three model families: 1,839,931 objective evaluations and 20,000 randomized weeks.
They preserve the 40–60 synthetic student range, 75–85 synthetic manager range,
and score >50 for ten medium assignments due in five days. Only three owner
ratings were available, one hypothetical: this is a product calibration, not a
validated population workload or mental-health measure.

## Fetch coverage and snapshot compatibility

Google and ICS event reads cover fourteen days, so every forecast date has its
full seven-day event window. ICS deadlines cover the 28-day exam window plus
seven forecast days. Ordinary tasks still taper out at fourteen days. Manual and
team tasks retain all open records. Month-window imports retain their explicit range.

Snapshots store `pressureModel` in the existing counts JSON; there is no schema
change. An owner read recomputes an old-model snapshot even within the normal
30-minute cache age. Team cards with an old model require a new sync, and previews
list them under no recent data. Posting still delivers their tasks atomically but
leaves the incompatible snapshot values unchanged. A successful owner sync stamps
the current model. No old raw values are combined with new task weights.

Completion removes only its own load. Focus and time-off blocks contribute zero
and cannot cancel unfinished tasks. No calendar contents are persisted.

## Clearing and recovery

- New calendar feeds start with deadlines dated on or after their connection day, using the feed's time zone or the owner's calendar zone. The existing source creation timestamp fixes that boundary without storing school contents. Later syncs retain work imported from that day when it becomes overdue, so missed work does not silently disappear. Calendar-month reads use the same boundary.
- Never automatically complete overdue work on a feed's first sync.
- Require review before bulk completion; the server accepts only owned, open, actually overdue source tasks.
- Retain completed or cleared source tasks in an owner-only disclosure. Restoring an item clears the owner's completion mark and immediately recomputes its pressure.
- Preserve existing completion marks; do not silently reopen submitted work. Legacy cleared ICS tasks are reviewable when still present in the fetched feed (up to 60 days overdue). Removed feed entries cannot be reconstructed because their contents are never stored.
- A task completed in its source, such as a closed GitHub issue, remains completed until reopened in that source.

The seven-day forecast assumes future tasks are completed by their due dates. Already-overdue work stays counted. Its explanation appears next to the forecast. ICS imports fetch an additional forecast horizon so approaching deadlines are available to those future calculations; calendar events include the additional forecast window.
