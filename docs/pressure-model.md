# Remaining-work pressure model

The gauge estimates the load of work still ahead. It does not subtract a reward for work already completed. All tunable values live in `lib/pressure/config.ts`; the server, optimistic UI, demo gauge and team assignment preview use the same engine.

## Defaults and rationale

| Input | Default | Meaning |
| --- | --- | --- |
| Task size | S 2, M 4, L 8 | Relative effort; each step doubles the task's weight. Source titles provide an initial guess that the owner can adjust. |
| Deadline horizon | 14 days | Next-week deadlines have preparation load before they enter the current week. Later tasks remain visible with an outside-window label. |
| Urgency | Reciprocal days until due, capped at 3 | Near-term work weighs more. Recently overdue tasks keep the cap. |
| Older overdue work | 0.5 × size after 14 overdue days | Keep unfinished backlog visible and counted without leaving every old item at peak urgency. The owner decides when it is done. |
| Event horizon | 7 days | Light 0.25, Normal 1, Heavy 1.6 per hour, adjusted for proximity, attendees and organizer responsibility. Recurring events default to Light. |
| Completion | Zero remaining load | Remove only that task's contribution. No temporary negative credit against other work. |
| Focus / out of office | Excluded | An availability block does not prove that an assignment was submitted. |
| Score scale | K = 8.5 | Keep the existing scale while fixing missing work and cancellation. Retain the established student and manager example ranges. |

These are product heuristics, not validated universal weights. Relative effort estimates are supported as a planning approach by [Atlassian's estimation guide](https://www.atlassian.com/agile/project-management/estimation). A fuller assessment such as [NASA TLX](https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/) includes dimensions this app cannot infer from a calendar. There is no basis here for claiming a universal measured workload scale.

Do not raise every task weight to compensate for missing imports, completion marks or incorrect dates. First verify coverage and status. Then compare the gauge with owners' assessments across light, typical and deadline-heavy weeks; adjust size guesses and the global scale from those examples. Points express relative effort, not hours or grades.

## False-zero regression

At a fixed instant, ten medium assignments due in five days contribute `10 × 4 / 5 = 8` raw points and score **61**. Previously, twenty just-completed medium tasks contributed `−40` raw points and canceled all ten pending assignments, displaying **0**. Completion now leaves the pending assignments' score at **61**.

Other checks cover preparation for a deadline ten days away, old overdue work, focus blocks, restoring cleared assignments, and equality between team previews, server results and optimistic changes.

## Clearing and recovery

- Never automatically complete overdue work on a feed's first sync.
- Require review before bulk completion; the server accepts only owned, open, actually overdue source tasks.
- Retain completed or cleared source tasks in an owner-only disclosure. Restoring an item clears the owner's completion mark and immediately recomputes its pressure.
- Preserve existing completion marks; do not silently reopen submitted work. Legacy cleared ICS tasks are reviewable when still present in the fetched feed (up to 60 days overdue). Removed feed entries cannot be reconstructed because their contents are never stored.
- A task completed in its source, such as a closed GitHub issue, remains completed until reopened in that source.

The seven-day forecast assumes future tasks are completed by their due dates. Already-overdue work stays counted. Its explanation appears next to the forecast. ICS imports fetch an additional forecast horizon so approaching deadlines are available to those future calculations; calendar events retain the existing seven-day fetch window.
