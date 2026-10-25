# Calendar and floating Pip

The Calendar tab at `/calendar` shows the signed-in owner’s open, dated deadlines in a full month grid. Choose a day for its deadlines and local due times, use the arrows to move between months, or choose Today. Arrow keys move between dates. On phones, day cells show counts and the selected-day list shows full titles. Calendar is also in the phone tab bar.

`GET /api/calendar/month?month=YYYY-MM&timeZone=IANA_ZONE` verifies the live user, scopes saved-task and source reads to that owner, and excludes completed tasks and calendar meetings. Saved deadlines use exact timezone-aware month boundaries. Imported ICS deadlines use a bounded month window with padding for differing feed zones and a final viewer-zone filter. Month fetches never read or populate the pressure-horizon source cache. No event contents are persisted and no database migration is needed. Source failures are shown as incomplete coverage; responses are private and not cached. Saved tasks are capped at 1,000 with a visible notice if truncated.

My Boiler keeps the workload and focus controls. Its former inline chat is removed. Plan with Pip and course-material questions open the floating chat with a draft. The floating chat retains the shared in-memory conversation, New conversation control, existing request/reply scope checks, course context, and opt-in study-card validation. Its compact shortcuts are below the message field; the old disclosure paragraph and Open My Boiler action are removed.

Verification covers leap-year grids, year rollover, timezone/DST boundaries, owner-only reads, completed imported items, full future-month loading without pressure-cache changes, browser month/day navigation and error recovery, and the floating chat’s retry/follow-up/reset workflow.
