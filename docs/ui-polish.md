# UI polish — 24 October 2026

This pass uses [Motion Design](https://github.com/lottiefiles/motion-design-skill), [Impeccable](https://impeccable.style/) and [Better UI](https://www.ui-skills.com/skills/jakubkrehel/better-ui). It preserves the iron/brass palette, Bebas/Inter/JetBrains typography and Pip.

## Changes and design decisions

| Principle | Finding | Change |
| --- | --- | --- |
| Hierarchy | Three source setup panels competed with connection health. | Existing connections first; a keyboard-operated source switcher below. Drafts remain mounted when switching. Apple Calendar subscriptions remain available after the connection controls. |
| Task priority | Schedule setup and repeated explanations pushed tasks down. | Forecast, tasks, class schedule, calendar subscription and one breakdown, in reading order. Heading before a compact Pip message. |
| Legibility | Low-contrast field boundaries and crowded phone task rows. | Dedicated control-boundary token, visible invalid/focus states, stacked size/points on narrow screens, workload count pills beside the gauge. |
| Feedback | Loading disabled controls could lose focus; success/error messages lacked consistent treatment. | Focusable guarded busy actions, shared announced feedback, retained failure drafts, input focus after successful imports, explicit confirmation and focus recovery for source removal. |
| Motion | Chart heights/widths and scattered timing were inconsistent. | Transform-based chart fills, 100ms color responses, 150ms button press at .96, 300ms/12px/4px arrivals with a 100ms stagger. High-frequency controls stay static. Reduced motion removes spatial motion and boiler loops; arrivals become a 120ms fade. |
| Finish | Navigation and browser-owned surfaces varied. | Selected navigation underline, consistent field radius, authored icons, palette selection/caret/scrollbar/focus styles. |

## Verification

Browser checks used the actual components in a temporary local fixture route, removed before the production build. API success/failure responses for source mutations were intercepted locally with fictional source IDs; no live account sources or assignments were changed.

| Check | Result |
| --- | --- |
| Desktop 1440, tablet 768, phones 390 and 320 | Rendered layouts inspected; inspected phone pages had no horizontal overflow. |
| Source keyboard navigation | Arrow keys, Home, tab selection and retained drafts verified. |
| Calendar import | Busy focus retained; failure preserved URL and showed invalid/error state; successful retry added the source, cleared input and focused it. |
| Existing GitHub connection test | Busy, successful result and retained focus verified with a local response. This UI test does not claim a new live GitHub credential test. |
| Source removal | Confirmation focus, Cancel focus return, and server failure retaining the row/focus verified. |
| Tasks | Add, complete and restore changed the score and open count consistently in demo data. |
| Team demo | Filter/empty state and assignment title/preview controls inspected at tablet and phone widths. |
| Reduced motion | Emulated preference verified: stopped boiler waves, static chart movement, short arrival fade. |
| Automated accessibility | Sources at 320: no axe violations or incomplete rules. Dashboard at 320: no violations, seven contrast nodes incomplete. Landing at 320: no violations, 21 contrast nodes incomplete. Incomplete contrast results are not counted as passes. |
| Impeccable source detector | One warning: selected navigation's 2px bottom border described as a card accent. Intentional tab underline on an inline navigation link; no card accent added. |
| React review | Stable keyed panels, unique labels, direct imports, guarded interactions, effect cleanup and server/client boundaries reviewed. |

Automated type, lint, unit and production-build checks accompany the commit. The unit suite contains existing expected failures; see QA documentation for their scope.

Not verified in this pass: physical touch devices, VoiceOver announcements, other browser engines, production performance metrics, native Apple Calendar handoff, or 10% animation-speed inspection (the available browser controls did not expose animation playback-rate control). This is not a complete WCAG conformance claim.
