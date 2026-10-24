# Boilerplate QA

The automated suite covers the public site, seeded demo, signed-out route/API boundaries, and the shipped PostgreSQL row-level security policies. Authenticated deployment checks are a separate, explicit command. A public-demo pass does not prove Google sign-in, calendar access, or live Supabase account behavior.

## Local QA army

TesterArmy is optional. The repository can run its browser instances on this computer with no TesterArmy account or run quota:

```sh
pnpm qa:army
```

This runs type checks, lint, unit/database contracts, a production build, and all six browser configurations. It picks an unused local port and uses synthetic demo data; the SQL contracts run in ephemeral PostgreSQL. It writes a separate dashboard and browser evidence to `qa-runs/<run>/index.html`. Each run reports failures, skips and flaky cases explicitly and exits unsuccessfully if any occur. Nothing is installed or purchased by this command.

```sh
pnpm qa:army --quick                    # Desktop Chromium only
pnpm qa:army --workers 4 --repeat 3      # Repeat every browser case three times
pnpm qa:ui                              # Select and watch public/demo tests interactively
pnpm qa:army --plan                     # Preview the selected work without starting it
```

On this Mac, double-click `Open QA Dashboard.command` in the QA checkout to open the interactive dashboard.

Two workers are the default for this laptop. `--workers` supports 1 to 16, and `--repeat` supports 1 to 100; higher concurrency needs more memory and may be slower on a busy computer. One runner owns the local build at a time; its workers are the parallel instances. Ctrl+C stops its child processes and marks the run interrupted. The interactive dashboard binds to localhost; it does not expose a control server to the network. Quick mode skips the separate unit/lint/type stages, while the production build still performs its standard checks.

To run locally controlled browsers against the deployed app, including all 32 existing synthetic accounts:

```sh
pnpm qa:army --url https://boilerhub.work --accounts
```

This mode uses the private `.qa/credentials-regression.json` bank and `.env.qa.local` already provisioned on this computer. It refreshes sessions through the existing account helper and caps account workers at four. Account checks are restricted to the verified app origin to avoid sending session cookies to another host. They use the live Supabase project, and opening a boiler performs its normal snapshot sync. Account failure contents, browser states, traces, videos and screenshots are excluded from the generated report. No new accounts or calendar grants are created.

This replaces the browser execution, parallel runs, repetition and reporting parts of TesterArmy. The scenarios are scripted: discovering new journeys still requires exploration and adding cases. `tests/e2e` holds the browser scenarios, and the historical cloud suite remains in `tests/testerarmy/suite.json`. Ordinary local runs don't contact TesterArmy or require an AI API key.

## Run locally

Use Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
pnpm exec playwright show-report
```

There are 34 public/demo scenarios across six configurations: Chromium, Firefox, WebKit, 390px mobile Chromium, 768px tablet Chromium, and 320px narrow Chromium (204 cases). Each case gets an isolated browser context. Local execution uses four workers; GitHub uses three shards with two workers each. These are desktop engines and viewport emulation, not real phones or iPads. The asset check covers the homepage, demo and formula pages, including failed Next.js chunks/styles and runtime exceptions.

The default command starts its own local server on port 3100; set `PLAYWRIGHT_PORT=3117` (or another free port) to run alongside another checkout. It refuses to reuse an unrelated running server. The placeholder Supabase URL/key support signed-out checks only; they do not access a real database. To check a production build, build with the same public environment values and set `PLAYWRIGHT_PRODUCTION=1`. To test an existing deployment without starting a server:

```sh
PLAYWRIGHT_BASE_URL=https://boilerhub.work pnpm test:e2e
```

The demo is synthetic and resets on reload. Public checks never complete Google OAuth or create real tasks. Browser traces, screenshots and video are saved only for failures and ignored by Git.

`pnpm test:database` runs the actual migrations in ephemeral PostgreSQL (PGlite), with 32 SQL identities, two main teams, and a small anonymity boundary fixture. It checks owner-only reads/writes, cross-team visibility, lead/member visibility, source-secret grants, token isolation, and anonymous RPC access. It does not simulate Supabase Auth, PostgREST, Google, or deployment configuration. Existing SQL visibility tests run as well.

## 32 reusable test accounts

`pnpm qa:accounts --plan` prints a secret-free plan. The bank contains 16 class identities, 15 work identities and one outsider, including four leads, all three visibility choices, all four statuses, every zone boundary, and missing/dim/stale snapshots. All email addresses use the reserved `example.test` domain.

Live provisioning requires administrative access to the intended Supabase project. Put these values in ignored `.env.qa.local` or the local environment:

```dotenv
QA_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
QA_SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
QA_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
QA_NAMESPACE=regression
```

Then run:

```sh
pnpm qa:accounts --apply
```

This creates 32 email/password Auth users with random independent passwords, two QA teams and 96 synthetic tasks. It confirms these synthetic addresses administratively and sends no emails. Reruns reuse only identities with the exact QA marker/namespace. They never reset another user's password or delete accounts. A partial failure preserves the private credential bank so the operation can be retried. Do not use the same namespace against another project with the same credential file.

Credentials are saved only in `.qa/credentials-regression.json` (directory 0700, file 0600), never printed or committed. The service key stays out of the file. Seeded boundary scores are illustrative; a user's next real sync recomputes pressure from the synthetic tasks. No Google identities, Google grants, calendar tokens or calendar events are created.

The public app currently offers Google sign-in. These password identities are for controlled test sessions through Supabase Auth, without introducing a new public login endpoint. To use one:

```sh
PLAYWRIGHT_BASE_URL=https://boilerhub.work pnpm qa:session class-lead-01
PLAYWRIGHT_BASE_URL=https://boilerhub.work QA_STORAGE_STATE=.qa/auth/class-lead-01.json pnpm test:e2e:auth
pnpm exec playwright open --load-storage=.qa/auth/class-lead-01.json https://boilerhub.work/boiler
```

Other keys include `class-member-03`, `work-lead-01`, `work-member-03`, and `outsider`; the plan lists all 32. Session generation verifies the authenticated user ID and saves real Supabase SSR cookies privately. Run it with the same target host used by the browser. The separate authenticated smoke test checks each user's team membership and visible teammate IDs, then opens their boiler and teams; opening a boiler performs the app's normal sync. It has no traces/video/screenshots enabled by default.

To regenerate and test every account together:

```sh
PLAYWRIGHT_BASE_URL=https://boilerhub.work pnpm qa:session --all
PLAYWRIGHT_BASE_URL=https://boilerhub.work QA_ACCOUNT_BANK=.qa/credentials-regression.json QA_AUTH_WORKERS=4 pnpm test:e2e:auth
```

The current 32-account bank and browser states were provisioned and verified in the live project, and copied into the primary local checkout's ignored `.qa` directory. The local `.env.qa.local` contains only the public project URL/anon key for future session refreshes. The temporary admin-key copy was removed after provisioning.

## GitHub Actions

`Boilerplate QA` runs on main pushes, pull requests and manual dispatch. It checks types, lint, unit/database contracts and all 204 browser cases. Reports are merged into a downloadable `browser-report` artifact; failed cases include traces and screenshots. All regression checks block CI. There are no quarantined or expected-failure defects.

`Authenticated QA` is a separate manual workflow against `https://boilerhub.work`. It checks out trusted main, prepares private sessions, and verifies all 32 live QA identities with four workers. `QA_ACCOUNT_BANK_JSON` and `QA_SUPABASE_ANON_KEY` are encrypted repository secrets; no Supabase admin key is used by this workflow. Every member identity also checks that both team APIs suppress hidden-member aggregates. It uploads no authenticated traces, screenshots, sessions or password files and removes `.qa` before finishing. Fork pull requests never receive these credentials.

Open [GitHub Actions](https://github.com/dsdsouza/Boiler-hub/actions) to run either workflow and inspect the exact results for the selected commit.

Focused regression checks: `pnpm test:e2e:known` (the historical command now runs passing, blocking regressions). All cases are included in `pnpm test:e2e`.

## TesterArmy

Project: Boilerplate (`RMqKVQlZMsQ_`), target `https://boilerhub.work/`. Twenty saved tests are versioned in `tests/testerarmy/suite.json`, including public, demo and mobile/tablet groups. The 2026-10-24 cloud account exhausted its five monthly runs and permits one concurrent run. Extra local/GitHub workers do not increase that quota.

The manual `TesterArmy cloud regression` workflow is ready to queue a saved group after a deployment. To activate it, enable Webhook in the chosen group's menu and save the generated URL as the GitHub Actions repository secret `TESTERARMY_GROUP_WEBHOOK_URL`. This secret has **not** been configured by this setup. The URL is never committed or logged. The workflow validates its destination, passes the commit/target/environment, and reports acceptance separately from actual test completion. See [TesterArmy group webhooks](https://docs.tester.army/run/group-webhooks).

## Regression repairs, 2026-10-24

| ID | Repair and verification |
| --- | --- |
| QA-001 | One demo owner hook supplies status and notes to both personal and team views. Browser checks cover propagation. |
| QA-002 | **No due date** creates an undated task with an honest label. Completing it removes its own load. |
| QA-003 | SQL restricts hidden counts to leads and suppresses counts below two; both APIs also enforce the role restriction. Migration 0005 is installed on the live project. |
| QA-004 | Main's remaining-work model already fixed completion credit. Completed-task resizing remains a normal browser regression. |
| QA-005 | Manual and assignment dates require explicit ISO timestamps and valid calendar dates. Numeric, ambiguous, impossible and timezone-free dates are rejected. |
| QA-006 | Assignment, task fan-out and snapshot updates commit atomically. Migrations 0006/0007 are installed. Exact snapshot revisions and bounded engine recomputation protect competing posts; original freshness and forecasts remain intact. Failure injection verifies rollback and duplicate retries. |
| QA-007 | Framework assets carry the available deployment identifier. An early bootstrap handler recovers missing JS/CSS through one cache-bypassing reload; persistent failures show an explicit retry and cannot loop. Browser tests inject missing assets and verify both paths. The historic infrastructure cause remains unconfirmed. |

Migrations are applied through the Supabase SQL editor, following `CLAUDE.md`. The older server-only posting signature is retained for compatibility during rollout. No calendar contents or additional account credentials are persisted. The hosting connector belongs to a different Vercel account, so platform Skew Protection settings could not be changed; recovery does not depend on that setting. See [Vercel Skew Protection](https://vercel.com/docs/skew-protection) and [Next.js deployment identity](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId).

Two earlier cloud findings were not substantiated: the completion report compared nonlinear displayed score points with raw pressure points, and the recurring-event report treated a rolling seven-day forecast change as a series leak. Neither is counted as a confirmed defect here. A reduced-motion development hydration warning was also observed; the stylesheet includes a reduced-motion fallback, so it is a diagnostic observation rather than a claimed animation failure.

Still unverified: Google OAuth/calendar refresh and revocation, real recurring event isolation, and the cloud webhook. The synthetic password accounts have no Google calendar grants. Keep service credentials, QA passwords and browser states out of GitHub artifacts and source control; the dedicated encrypted repository secrets hold only synthetic user credentials and the public project key.

## Execution record

On 2026-10-24, against main baseline `c635a3c`: the production build, type check and lint passed; Vitest reported 178 passed and five expected failures; all 162 regular browser cases passed with zero retries, skips or flaky cases. The three browser defects above were reproduced separately with failing assertions and saved screenshots/traces. Thirty-two SQL identities were created in the ephemeral database; no live Supabase users were provisioned. The repository had no Supabase credentials, no accessible connected Supabase project, and no TesterArmy webhook secret.

After pushing `d0e5145`, the live deployment run passed 161/162 cases and exposed QA-007. The failed gauge boundary passed three sequential rechecks after the rollout. An additional asset-health scenario was then added and passed across all six configurations against the production build, bringing the regular suite to 168 cases. Treat the rollout failure as a real captured deployment problem, not an additional successful run.

Subsequently, the existing signed-in Supabase dashboard provided access to the project confirmed by the app's sign-in redirect. Thirty-two real Auth users, two teams and 96 synthetic tasks were created. All 32 password sign-ins, owner-only profile/task reads, and cross-team/visibility RPC checks passed; all 27 non-lead members reproduced QA-003. All 32 authenticated browser smoke tests passed. The original authenticated run deliberately included the privacy assertion and reported 27 failures/5 passes; the privacy contract now has its own explicit known-issue command.

The setup then incorporated main's calendar/interface merge `36fd888`. The production build passed and the unit/database suite expanded to 229 passed plus five expected failures, including the calendar-subscription SQL contract. A WebKit asset check exposed a local test-origin mismatch (127.0.0.1 versus localhost); the server and browser origins were aligned, and all six asset checks passed afterward. The refreshed full browser suite has 168 cases; GitHub reports the complete results for each subsequent commit. The live HTTP privacy recheck returned hidden counts `[11, 11]` from Engine Room/team-list endpoints for `class-member-03`, where the contract expects `[0, 0]`.


After these repairs, the complete production-browser suite passed **198/198** cases across all six configurations, with no retries or skipped tests. **284/284 unit/database tests**, type checks, lint and the production build passed. Database tests cover mid-transaction rollback, same-draft idempotency, stale revision rejection, service-role execution and decimal serialization. A live service-role transaction fanned out to all 14 class members and was rolled back. The live hidden-count function was checked against every membership without persisting test changes.
