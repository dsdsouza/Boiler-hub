# Boilerplate QA

The automated suite covers the public site, seeded demo, signed-out route/API boundaries, and the shipped PostgreSQL row-level security policies. Authenticated deployment checks are a separate, explicit command. A public-demo pass does not prove Google sign-in, calendar access, or live Supabase account behavior.

## Run locally

Use Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
pnpm exec playwright show-report
```

There are 28 public/demo scenarios across six configurations: Chromium, Firefox, WebKit, 390px mobile Chromium, 768px tablet Chromium, and 320px narrow Chromium (168 cases). Each case gets an isolated browser context. Local execution uses four workers; GitHub uses three shards with two workers each. These are desktop engines and viewport emulation, not real phones or iPads. The asset check covers the homepage, demo, formula and privacy pages, including failed Next.js chunks/styles and runtime exceptions.

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

Other keys include `class-member-03`, `work-lead-01`, `work-member-03`, and `outsider`; the plan lists all 32. Session generation verifies the authenticated user ID and saves real Supabase SSR cookies privately. Run it with the same target host used by the browser. The separate authenticated smoke test reads the user's teams and opens their boiler; opening a boiler performs the app's normal sync. It has no traces/video/screenshots enabled by default. Authenticated provisioning and smoke tests have **not** been run unless the execution record explicitly says so.

## GitHub Actions

`Boilerplate QA` runs on staging/main pushes, every pull request, merge groups and manual dispatch. It checks types, lint, all unit/database contracts and all 186 browser cases across Chromium, Firefox, WebKit and three small-screen configurations. The former quarantined defects are ordinary blocking regressions. No expected-failure tests or nonblocking defect job remain. Reports are merged into a downloadable `browser-report` artifact; failed cases include traces and screenshots.

The final **QA gate** job runs even when a dependency fails or is skipped, and succeeds only when contracts, every browser shard and report generation succeed. It is the single required status check for `main`. A test that needs a retry is a CI failure (`failOnFlakyTests`); failed tests cannot pass the gate merely because a dependent job was skipped.

GitHub must also enforce this check in repository settings. After the first successful staging run, a repository administrator can run `pnpm qa:protect-main` while authenticated through `gh`. The script verifies admin permission, finds the successful Actions check, pins its GitHub App, and requires an up-to-date PR plus **QA gate**, including for administrators. Force pushes and branch deletion are disabled. A workflow file alone cannot prevent merging; verify the server-side protection separately. The script intentionally changes only this repository's `main` branch.

Focused regression command: `pnpm test:e2e:regressions`. Full local check: `pnpm qa:check` (start with `pnpm build` and `PLAYWRIGHT_PRODUCTION=1` for production-browser testing).

## TesterArmy

Project: Boilerplate (`RMqKVQlZMsQ_`), target `https://boilerhub.work/`. Twenty saved tests are versioned in `tests/testerarmy/suite.json`, including public, demo and mobile/tablet groups. The 2026-10-24 cloud account exhausted its five monthly runs and permits one concurrent run. Extra local/GitHub workers do not increase that quota.

The manual `TesterArmy cloud regression` workflow is ready to queue a saved group after a deployment. To activate it, enable Webhook in the chosen group's menu and save the generated URL as the GitHub Actions repository secret `TESTERARMY_GROUP_WEBHOOK_URL`. This secret has **not** been configured by this setup. The URL is never committed or logged. The workflow validates its destination, passes the commit/target/environment, and reports acceptance separately from actual test completion. See [TesterArmy group webhooks](https://docs.tester.army/run/group-webhooks).

## Regression fixes, 2026-10-24

| ID | Result | Regression coverage |
| --- | --- | --- |
| QA-001 | A shared demo owner state supplies Maya's status and note to the team card, including after team switching. Reload resets the fixture. | `tests/e2e/regressions.spec.ts` |
| QA-002 | The form offers **No due date**. Undated tasks retain their remaining-work load, render an honest label and complete normally. | Browser regression and existing request/engine contracts |
| QA-003 | Migration 0005 restricts the hidden-count RPC to leads and suppresses counts below two in SQL itself. | All 32 SQL identities, positive lead aggregates, outsiders, direct RPCs and legacy SQL contract |
| QA-004 | The newer staging model already removes completion credit. Completed-task resizing preserves other work, and reopening uses the new size. | Normal demo lifecycle regression |
| QA-005 | Manual and team task dates require ISO date-times with explicit timezones and real calendar dates. Numeric, ambiguous, impossible and timezone-free inputs are rejected. | `tests/contracts/task-dates.test.ts` |
| QA-006 | Migration 0006 posts the draft, recipient tasks and snapshots in one transaction. A failed snapshot update leaves no partial post; retry succeeds once. Stale snapshots or changed membership roll back instead of overwriting newer work. | Real helper calling migrated PostgreSQL, injected trigger failure, duplicate retry, hidden/never-synced recipients, service-role and client authorization |
| Stale Privacy check | Public asset smoke covers the current routes and separately requires `/privacy` to return 404. | All six browser configurations |
| QA-007 (historic rollout) | Prior live loads briefly referenced missing assets; no infrastructure cause was established. Asset and runtime checks remain in the blocking browser suite. | Sanitized historic evidence: `tests/evidence/deployment-assets-20261024.json` |

Migrations 0005 and 0006 must be applied through the Supabase SQL editor before deploying the new assignment API, per `CLAUDE.md`. They preserve existing tables, event privacy, recipient freshness and forecasts. They prevent new partial posts; recipients of any historic interrupted post reconcile through their normal sync.

Two earlier cloud findings were not substantiated: the completion report compared nonlinear displayed score points with raw pressure points, and the recurring-event report treated a rolling seven-day forecast change as a series leak. Neither is counted as a confirmed defect here. A reduced-motion development hydration warning was also observed; the stylesheet includes a reduced-motion fallback, so it is a diagnostic observation rather than a claimed animation failure.

Still outside this automated gate: fresh Google OAuth consent/revocation, real recurring-event isolation, provisioned live QA account flows, a real Brightspace school feed and the cloud webhook. The existing signed-in session was previously checked for Google refresh, source validation and mobile layout; those checks do not substitute for these unverified flows. Keep service credentials, QA passwords and browser states out of GitHub artifacts and source control.

## Execution record

On 2026-10-24, against main baseline `c635a3c`: the production build, type check and lint passed; Vitest reported 178 passed and five expected failures; all 162 regular browser cases passed with zero retries, skips or flaky cases. The three browser defects above were reproduced separately with failing assertions and saved screenshots/traces. Thirty-two SQL identities were created in the ephemeral database; no live Supabase users were provisioned. The repository had no Supabase credentials, no accessible connected Supabase project, and no TesterArmy webhook secret.

After pushing `d0e5145`, the live deployment run passed 161/162 cases and exposed QA-007. The failed gauge boundary passed three sequential rechecks after the rollout. An additional asset-health scenario was then added and passed across all six configurations against the production build, bringing the regular suite to 168 cases. Treat the rollout failure as a real captured deployment problem, not an additional successful run.


After the regression fixes, the production build, type check and lint passed. Vitest passed **274/274** tests across 33 files, with no expected failures. The production-browser suite passed **186/186** cases across all six configurations, with zero retries, skips or flaky tests. The first development pass exposed a reload assertion that did not reselect the demo team and a local WebKit origin mismatch; both were corrected before this final run.

Migrations **0005 and 0006 were applied through the Supabase SQL editor** to the project verified against the live app's sign-in destination. A read-only transaction checked the hidden-count contract for every existing membership in the live database. The atomic posting function is installed, executable by `service_role`, and inaccessible to `authenticated`; no user data was inserted or changed by that verification. Failure injection and rollback recovery were exercised only in ephemeral PostgreSQL.

Repository administration is separate from pushing code. The available GitHub CLI accounts lack admin permission, and the signed-in browser shows “You don't have access to repository options.” The owner setup command above is provided so required-check enforcement can be completed without changing credentials. Do not treat the workflow's presence as proof that branch protection is enabled.
