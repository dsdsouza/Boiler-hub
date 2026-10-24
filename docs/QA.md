# QA status

## Staging follow-up — October 24, 2026

The requested onboarding copy is removed. Meeting, hour, due and optional overdue totals now use individual rounded badges in onboarding and team tiles. On phones, the first-reading message has a full row so it does not wrap into a narrow column.

### Browser coverage

Checks used the Codex in-app browser on macOS. Local layout checks covered 320, 390, 768 and 1440 CSS-pixel widths. Both themes were exercised. Local fixture routes rendered the actual application components; intercepted API responses supplied test data and failures. These temporary routes were deleted before the production build. Production authentication checks remained unchanged, and the fixtures used no real account data.

| Flow | Result and evidence |
| --- | --- |
| Live Google sign-in → onboarding | User completed sign-in. Calendar connected successfully with an empty calendar. The domain was still serving the earlier UI during this pass. |
| Live My Boiler, Teams, Sources | Signed-in pages loaded, including their empty states, with no observed console errors. No tasks, teams, sources or status changes were written to the live account. |
| Onboarding, empty calendar | Three separate badges: `0 meetings`, `0 h`, `0 due`. Requested text absent; one status heading. No page overflow at the four tested widths. |
| Onboarding, failed sync | A simulated 503 displayed an error and Try again. Retrying with a successful response restored the gauge and status picker. |
| Onboarding, disconnected calendar | Reconnect link and tasks-only explanation remained visible. |
| Onboarding, status failure | A simulated failed save restored the previous selection and displayed the error. |
| Invalid invite code | A simulated 404 retained the entered code and displayed the error. |
| Calendar feed failure | A simulated 502 retained the entered URL and displayed the error. No real feed was fetched. |
| Assignment preview race | Reproduced a late response enabling Post after the title was cleared. Fixed cancellation and posting guards; retest kept the preview empty and Post disabled. |
| Assignment error → retry → post | Simulated failure left Post disabled. A changed draft recovered; a successful simulated post focused the Posted result. |
| Phone assignment shortcut | New assignment moved focus to the title field. |
| My Boiler initial failure | Added Try again; a simulated successful retry recovered the page. |
| Failed task save | Fixed rollback hiding the error and losing the draft. Retest retained both error and entered title. |
| Task save in progress | Busy state prevents repeat submission. A newer draft typed while the response is pending survives the earlier successful save. |
| Demo | Both teams, zone filters and empty results, blank assignment validation, assignment posting/drafting, task creation/completion/undo, breakdown expansion, and event weighting worked. Changing an event to Light lowered the displayed pressure. |
| Pip | Fixed the breakdown action targeting a removed heading ID. Retest focused the visible breakdown heading. Escape closes the wardrobe and restores focus to Dress up. |
| Formula | Named, keyboard-focusable region remains horizontally scrollable on a phone. |
| Reduced motion | Fixed the boiler only reading the preference at mount. Changing the media preference now switches all five landing boilers between animated and still states without a reload. |
| Pressure slider | Pointer dragging changed the score; keyboard Home/End reached 0/100. Synthetic touch input is unsupported in this browser and was not verified. |

### Accessibility and UI repairs

Axe checks using WCAG 2 A/AA, WCAG 2.1 AA and best-practice rules reported no violations in the tested local onboarding, My Boiler, Engine Room, demo, landing and How screens. Theme/viewport combinations are recorded in the session's local evidence. Each scan left a color-contrast check incomplete, so this is not a claim of complete WCAG conformance.

The pass also made footer, logo, slider, team visibility and back-link targets at least 44px tall; exposed marketing navigation on phones; added Sources to the phone tab bar; exposed phone sign-out; underlined token help links; linked team tooltips to their tiles and moved them above the boiler; reduced preview live announcements to the summary; and let the date input inherit the active theme.

### Verification limits

The production build, TypeScript check, ESLint and all 133 tests in 19 files passed. The Impeccable source detector returned no findings on the changed UI files.

- The revised UI was verified locally. The live domain still showed the earlier version during QA; deployment must be checked separately.
- The live calendar contained no events. Populated Google calendars, real ICS/GitHub ingestion, multi-account visibility, role changes and real assignment fan-out were not tested end to end.
- Replacing existing single-event tags through the series confirmation was not exercised in the browser; the existing logic tests cover series/single-event behavior.
- Checks used one browser engine and emulated viewport/media settings. Physical touch devices, other browsers, assistive technology and measured performance under throttling remain unverified.
- Google consent still advertises the earlier Vercel Privacy URL. Review that external OAuth setting when deploying the requested removal of the Privacy route.

## Remaining issues from the earlier audit

The following findings are retained from the earlier October 24 production/main audit. They were not revalidated or changed by this UI pass. "Verified" means the earlier audit observed the behavior in a browser; "code" means it was identified in source.

## Mobile and touch

| Issue | Where | How found |
| --- | --- | --- |
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

## Tooling

- On this Windows machine, `pnpm build` occasionally fails with `Invariant: no direct app page entry found for …` or a `next/font` fetch error, then succeeds on a clean rebuild (`rm -rf .next && pnpm build`). Vercel builds have not shown it.
