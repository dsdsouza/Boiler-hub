# QA: known issues

From the QA pass of Oct 24, 2026 on production and main. The P1 items and the P2 items picked for fixing shipped in `fix/p1-data`, `fix/docs` and `fix/p1-ui`. What is left is listed here, roughly most useful first. "Verified" means seen in a browser (headless Chrome, CPU throttled 4x where noted); "code" means found by reading the code.

## Accessibility

| Issue | Where | How found |
| --- | --- | --- |
| Help links inside text are told apart by color only (axe "link-in-text-block", 1.1 to 1.7:1). The privacy mailto link is now underlined; the two token help links are not. | `components/sources/SourceForms.tsx` | Verified (axe) |
| The formula block on `/how` scrolls sideways at 390px but cannot be reached by keyboard (axe "scrollable-region-focusable"). Add `tabIndex={0}` and a label. | `app/how/page.tsx` | Verified (axe) |
| The demo banner (`role="note"`) sits outside every landmark (axe, moderate). | `app/demo/page.tsx` | Verified (axe) |
| Task checkbox both changes its label ("Mark not done: X") and announces itself as pressed. Use one or the other. | `components/boiler/TaskList.tsx` | Verified |
| The assignment preview is one `role="status"` region around the whole table, so a screen reader re-reads every row on each change. Move the live region to the summary line. | `app/teams/_components/AssignmentPanel.tsx` | Code |
| Engine Room tile tooltip (`role="tooltip"`) is not linked with `aria-describedby`, and when shown on focus it covers the tile's boiler. | `app/teams/_components/BoilerTile.tsx` | Verified |
| Onboarding step 3 shows "Your status" twice (step title and the picker's own label). | `app/onboarding/OnboardingClient.tsx`, `components/boiler/StatusPicker.tsx` | Verified |

## Mobile and touch

| Issue | Where | How found |
| --- | --- | --- |
| Tap targets under 44px at 390px: footer links (20px tall), landing pressure slider (28px), "Your visibility on this team" summary (32px), "← My Teams" (20px), logo link (30px). | `components/ui/SiteFooter.tsx`, `components/boiler/HeroBoiler.tsx`, `app/teams/_components/EngineRoom.tsx`, `components/ui/SiteHeader.tsx` | Verified |
| `/`, `/demo` and `/privacy` hide the nav below 768px and have no tab bar, so on a phone only the footer links remain. | `components/ui/SiteHeader.tsx` (marketing variant) | Verified |
| The assignment due-date input forces `color-scheme: dark`, so the light theme gets a dark native date picker. | `app/teams/_components/AssignmentPanel.tsx` | Code |
| The visibility radios use 14px text. Radios do not trigger iOS zoom, so they were left as is when text fields moved to 16px. | `app/teams/_components/VisibilityPicker.tsx` | Verified |

## Data and time

| Issue | Where | How found |
| --- | --- | --- |
| When Google is disconnected or unavailable, forecast day boundaries fall back to UTC, so a late-evening US deadline lands one forecast day late. | `lib/google/sync.ts` (`timeZone: "UTC"` fallback) | Code |
| All-day items from a feed with no `X-WR-TIMEZONE`, synced while Google is not connected, fall due at 23:59 UTC (7:59 PM in New York). | `lib/sources/ics.ts` | Code |
| ICS items more than 60 days overdue drop out of the feed window entirely instead of staying listed as stale. Only matters for items that were never marked done. | `lib/sources/ics.ts` (`LOOKBACK_DAYS`) | Code |
| Stale team assignments and source items can only be marked done, not removed (only manual tasks have Remove). | `components/boiler/TaskList.tsx`, `app/api/tasks/[id]/route.ts` | Code |
| The daily cron stops starting new batches after 50 seconds. With many users, the rest wait until the next day (there is no cursor to resume from). | `app/api/cron/resync/route.ts` | Code |
| With one hidden member, team size shown in the Engine Room and on Teams leaves that member out, so it reads one lower than the real roster. This is the intended k-anonymity tradeoff. | `lib/data/teams.ts` | Code |
| ICS fetch checks every resolved address, but `fetch` resolves the name again after the check (DNS rebinding). Closing it needs a dispatcher that pins the checked address. | `lib/sources/fetch.ts` | Code |

## Verification gaps

These batch-3 changes are in the code and pass typecheck, lint and tests, but were not exercised in a signed-in browser (the pages need Google sign-in):

- The sticky "+ New assignment" button and its jump to the panel (`app/teams/_components/EngineRoom.tsx`).
- Focus moving to the "Posted" result after posting an assignment.
- The restored focus rings on Engine Room tiles, the assignment title and the team forms (`focus-visible:outline-solid`).
- The "Replace their own tags?" confirm when tagging a series.

## Tooling

- On this Windows machine, `pnpm build` occasionally fails with `Invariant: no direct app page entry found for …` or a `next/font` fetch error, then succeeds on a clean rebuild (`rm -rf .next && pnpm build`). Vercel builds have not shown it.
