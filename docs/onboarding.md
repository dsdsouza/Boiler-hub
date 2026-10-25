# Guided onboarding

`/onboarding` replaces the old “Light your boiler” setup page. It is public until the account step; all data mutations still require a verified Supabase user.

The journey asks for identity, name, goal and starting point, introduces Pip, and returns from Google OAuth to the same account step. It then offers Calendar Finder, goal-specific setup, the first calendar reading, status, optional sources and team joining, a recommendation, and completion. A deadlines path adds a first task and, when a task is entered, a target date. The focus path also offers Focus with Pip. Team goals finish in Teams; other paths finish in My Boiler.

Only Continue unlocks the next question. Required answers must be valid. Back, the progress controls, vertical scrolling and swiping revisit unlocked steps. Previously unlocked forms stay mounted so unsent source fields survive back navigation. Optional setup can be skipped.

## Saved progress

- Tab-local answers use `sessionStorage["boiler:onboarding:v1"]`, including the current step. The sign-in action checks that storage works before leaving.
- After login, `GET /api/me/onboarding` loads the verified user’s saved draft. Drafts are bound to that user; another account’s draft is discarded.
- Continue saves through `PATCH /api/me/onboarding` into the current user’s Supabase `user_metadata.onboarding`. No database migration is needed.
- Completion saves the profile name and status. An optional first task uses a stable, owner-scoped UUID, so retries update the same task. The deadline is sent as the user’s local end-of-day timestamp.
- Tokens and subscription URLs never enter the onboarding draft. Existing source forms handle them. Calendar handoffs use the existing short-lived, tab-scoped helper storage and strip the fragment from the address bar.

## Extension detection

Calendar Finder and Focus with Pip have isolated content scripts limited to Boilerplate’s production origins and localhost. The onboarding page sends `bp-extension:ping` with an extension kind and fresh nonce. The matching extension returns `bp-extension:pong`, the nonce, and its installed manifest version. The page checks the message origin, source, kind and nonce. This check is installation feedback, not an authorization mechanism.

Continue stays disabled until the chosen extension answers. Skip remains available. The check repeats when the tab regains focus, and users can select Check again. Newly installed extensions may require refreshing the onboarding page; answers are retained.

Calendar Finder’s “Use in onboarding” action hands the reviewed feed into `/onboarding#feed=…`; the link is ready in the calendar step. The standard review flow remains available for people using Sources independently.

Rebuild the Calendar Finder download with `pnpm helper:package` after editing `browser-helper/`. Its test checks that the distributed ZIP exactly matches source. The Focus download is `public/downloads/boilerplate-focus-extension.zip`.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` cover the current source. Private browser states and test captures stay outside the committed source.

The onboarding model tests cover adaptive paths and unlocking. API tests cover account ownership, unauthenticated requests, completion validation, retry-safe first-task writes, status saves and save failures. Bridge tests cover valid requests and rejection of unrelated messages. Browser QA covers mobile layouts, back/scroll/swipe navigation, draft restoration through a simulated login, missing and genuinely installed extensions, calendar errors, retained source forms and final navigation.

Real Google OAuth was verified against the existing Supabase project on October 24, 2026: the saved public answers returned to the account step, Calendar connected, final profile/status and a dated first task persisted, and the flow opened My Boiler. Temporary profile changes, onboarding metadata and the QA task were restored afterward. Google’s unverified-app warning and consent were completed by the account owner.

Local development needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Full calendar sync also needs the existing server credentials in `.env.example`; keep those server-side. Supabase currently permits `http://localhost:3000/auth/callback` (also ports 3001 and 3002), so use an allowed origin for OAuth. A preview on an unlisted port falls back to the Supabase site URL and cannot complete the local PKCE journey. Authentication derives the callback from the browser origin, safely preserves the next path, and returns failures to the saved onboarding flow.

The local workflow suite checks completion across Chromium, Firefox, WebKit and a phone, including a revised deadline and restored draft. Live workflow tests use synthetic accounts and restore their original profile and metadata. The Google consent path is verified separately with a real account; it is never simulated and described as a real Google login.
