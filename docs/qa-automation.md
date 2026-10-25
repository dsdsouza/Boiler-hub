# Boilerplate QA

The automated suite covers the public site, seeded demo, signed-out route/API boundaries, shipped PostgreSQL row-level security policies, and component save/failure behavior. Signed-in checks and exploration are explicit commands using the private synthetic account bank. A public-demo pass does not prove Google sign-in, calendar access, or live Supabase account behavior.

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
pnpm qa:army --url https://boilerplate.zhomander.workers.dev --accounts
```

This mode uses the private `.qa/credentials-regression.json` bank and `.env.qa.local` already provisioned on this computer. It refreshes sessions through the existing account helper and caps account workers at four. Account checks accept only the exact verified Cloudflare origin and the retained `boilerhub.work` origin, preventing session cookies from reaching other Workers or preview hosts. They use the live Supabase project, and opening a boiler performs its normal snapshot sync. Account failure contents, browser states, traces, videos and screenshots are excluded from the generated report. No new accounts or calendar grants are created.

This replaces the browser execution, parallel runs, repetition and reporting parts of TesterArmy. The scenarios are scripted: discovering new journeys still requires exploration and adding cases. `tests/e2e` holds the browser scenarios, and the historical cloud suite remains in `tests/testerarmy/suite.json`. Ordinary local runs don't contact TesterArmy or require an AI API key.

### Discover new paths locally

On this Mac, double-click `Find New Bugs.command` in `Desktop/Boiler-hub-QA` to start eight workers. Each run saves a separate report with the discovered paths and findings.

```sh
pnpm qa:explore --workers 8
pnpm qa:explore --workers 16 --walks 8 --steps 60 --seed 10424
```

The explorer inventories currently visible controls after every action and favors actions it has not tried. It combines button clicks, task and assignment input, long/Unicode text, select changes, event tags, disclosures, wardrobe controls, public links, reloads, keyboard actions and viewport changes into new sequences. It checks browser errors, missing assets, page/text overflow, pressure bounds, forecast agreement, personal/team agreement, status/completion behavior and assignment delivery. The default is eight walks in each of four browser configurations (32 walks, up to 1,920 selected actions). `--quick` uses Chromium only; `--walks`, `--steps` and `--seed` control the run. A new invocation gets a fresh seed unless one is specified.

Each walk attaches its seed, engine, visited routes, selected actions and candidate findings as `exploration.json` in the browser report. Reports include the checkout revision and uncommitted-state flag. Replay with the same seed and browser; the recorded action history helps reproduction when the app or clock has changed. A discovered finding fails the run and still allows the remaining walks to collect evidence. Timeouts and interrupted walks are failures, not passes. Video recording is off for exploration; failed walks keep screenshots and traces.

This is a bounded state explorer with product invariants, not an autonomous language model. Its default target is the public site and synthetic demo. Human/agent triage confirms findings and adds focused regressions before fixes. The first pass discovered real shared-pressure and long-text bugs that the earlier fixed scenarios missed.

### Explore the signed-in app

Double-click `Find Signed-In Bugs.command`, or run:

```sh
pnpm qa:explore --url https://boilerhub.work --accounts --workers 16 --walks 2 --steps 60
```

This runs public exploration, isolated component regressions and then signed-in exploration with the 32 existing QA identities. It assigns Chromium, Firefox, WebKit and mobile Chromium across the bank, with up to 16 local browser workers. Walks for one identity run sequentially. Each signed-in walk creates one uniquely named manual task, discovers visible controls and links, and explores its own task completion/size, status/note, wardrobe, team filters, assignment drafts/previews, source help, onboarding, navigation, reloads and screen sizes. It compares the owner's displayed score/status with the real API. It does not post team assignments, promote members, create/join teams, confirm subscriptions, add external sources or complete Google consent.

Cleanup deletes only the walk's own new manual task IDs and restores the original status/note and visibility. Existing fixture tasks, roles and sources remain untouched. Both successful and failing walks attempt cleanup. An interrupted process may need the same synthetic task prefix reviewed before rerunning. Failure, cleanup failure, timeout and an incomplete walk all fail the run; there are no retries or skipped findings. The target origin, project URL, synthetic email addresses and bank marker are checked before browser sessions are loaded.

Signed-in screenshots, videos and traces are disabled. Detailed seeds, selected actions and visited routes stay in `.qa/signed-history-<run>.json` with private permissions. Public run reports receive counts only. Credentials and cookies are never copied to these histories. This mode needs the existing private bank and public Supabase key, but no admin key or Google calendar grants. Its server target is the deployed app; browser execution is local.

### Reproduce slow saves and failures

`pnpm test:components` renders the actual application components in a disposable local copy, with fictional responses and controlled request delays/failures. It checks privacy-save serialization, draft preservation, long names, status acknowledgements, ordered owner writes and pending task identities in four browser configurations. The temporary QA route exists only in that copy; it is never added to the deployed app. No environment files or account bank are copied. Full `qa:army`/`qa:explore` runs and GitHub's browser shards include this suite. When `PLAYWRIGHT_PRODUCTION=1` is set (as in CI and the full local runner), the disposable harness is built and served with Next's production server. This prevents development Fast Refresh from replacing a document during navigation or session checks. Local development runs keep the faster development server. Public asset checks inspect each cold document independently, while return-to-home hydration checks follow visible in-app links. Both collect runtime errors throughout the inspected page; teardown cancellations from a departing document are not attributed to the next route.

Feature branches matching `staging-*` or `staging/**` run the credential-free QA gate on push. The gate includes the Cloudflare build, a dry run and 48 public cases against the local Workers runtime, preserving the newer main deployment setup. Wait for that gate and both preview build statuses to pass before opening a PR; then require the PR checks to pass before merging. The authenticated GitHub workflow continues to check trusted main only and never exposes account credentials to branch or fork code.

## Run locally

Use Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
pnpm exec playwright show-report
```

There are 48 public/demo scenarios across six configurations: Chromium, Firefox, WebKit, 390px mobile Chromium, 768px tablet Chromium, and 320px narrow Chromium (288 cases). Each case gets an isolated browser context. Local execution uses four workers; GitHub uses three shards with two workers each. These are desktop engines and viewport emulation, not real phones or iPads. The asset check covers the homepage, demo and formula pages, including failed Next.js chunks/styles and runtime exceptions.


The default command starts its own local server on port 3100; set `PLAYWRIGHT_PORT=3117` (or another free port) to run alongside another checkout. It refuses to reuse an unrelated running server. The placeholder Supabase URL/key support signed-out checks only; they do not access a real database. To check a production build, build with the same public environment values and set `PLAYWRIGHT_PRODUCTION=1`. To test an existing deployment without starting a server:

```sh
PLAYWRIGHT_BASE_URL=https://boilerplate.zhomander.workers.dev pnpm test:e2e
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
PLAYWRIGHT_BASE_URL=https://boilerplate.zhomander.workers.dev pnpm qa:session class-lead-01
PLAYWRIGHT_BASE_URL=https://boilerplate.zhomander.workers.dev QA_STORAGE_STATE=.qa/auth/class-lead-01.json pnpm test:e2e:auth
pnpm exec playwright open --load-storage=.qa/auth/class-lead-01.json https://boilerplate.zhomander.workers.dev/boiler
```

Other keys include `class-member-03`, `work-lead-01`, `work-member-03`, and `outsider`; the plan lists all 32. Session generation verifies the authenticated user ID and saves real Supabase SSR cookies privately. Run it with the same target host used by the browser. The separate authenticated smoke test checks each user's team membership and visible teammate IDs, then opens their boiler and teams; opening a boiler performs the app's normal sync. It has no traces/video/screenshots enabled by default.

To regenerate and test every account together:

```sh
PLAYWRIGHT_BASE_URL=https://boilerplate.zhomander.workers.dev pnpm qa:session --all
PLAYWRIGHT_BASE_URL=https://boilerplate.zhomander.workers.dev QA_ACCOUNT_BANK=.qa/credentials-regression.json QA_AUTH_WORKERS=4 pnpm test:e2e:auth
```

The current 32-account bank and browser states were provisioned and verified in the live project, and copied into the primary local checkout's ignored `.qa` directory. The local `.env.qa.local` contains only the public project URL/anon key for future session refreshes. The temporary admin-key copy was removed after provisioning.

## GitHub Actions

`Boilerplate QA` runs on main/staging and `staging-*`/`staging/**` pushes, every pull request, merge groups and manual dispatch. It checks types, lint, all unit/database contracts, 288 public/demo browser cases, 48 component cases and 48 cases on the Workers runtime. It also builds and bundles the Cloudflare Worker without deploying or receiving deployment credentials. The former quarantined defects are ordinary blocking regressions. No expected-failure tests or nonblocking defect job remain. Public reports are merged into a downloadable `browser-report` artifact; failed cases include traces and screenshots.


The final **QA gate** job runs even when a dependency fails or is skipped, and succeeds only when contracts, every browser shard and report generation succeed. It is the check intended for required-status enforcement on `main`; the owner will enable that setting separately. A test that needs a retry is a CI failure (`failOnFlakyTests`); failed tests cannot pass the gate merely because a dependent job was skipped.

GitHub must also enforce this check in repository settings. After the first successful staging run, a repository administrator can run `pnpm qa:protect-main` while authenticated through `gh`. The script verifies admin permission, finds the successful Actions check, pins its GitHub App, and requires an up-to-date PR plus **QA gate**, including for administrators. Force pushes and branch deletion are disabled. A workflow file alone cannot prevent merging; verify the server-side protection separately. The script intentionally changes only this repository's `main` branch.

Focused regression command: `pnpm test:e2e:regressions`. Full local check: `pnpm qa:check` (start with `pnpm build` and `PLAYWRIGHT_PRODUCTION=1` for production-browser testing).

`Authenticated QA` is a separate manual workflow that checks trusted main against the live Cloudflare deployment using the 32 synthetic accounts. The encrypted repository secrets contain only the synthetic credential bank and the public project key; no admin key is used. All account and privacy assertions are blocking, with no defect quarantine. Authenticated traces, screenshots, sessions and password files are never uploaded, and the workflow removes `.qa` on completion. This live integration run is separate from the credential-free PR gate so fork code never receives account credentials.

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
| QA-006 | Migrations 0006 and 0007 post the draft, recipient tasks and snapshots in one transaction with revision checks and bounded conflict retries. A failed snapshot update leaves no partial post; retry succeeds once. Stale snapshots or changed membership roll back instead of overwriting newer work. | Real helper calling migrated PostgreSQL, injected trigger failure, duplicate retry, hidden/never-synced recipients, service-role and client authorization |
| Stale Privacy check | Public asset smoke covers the current routes and separately requires `/privacy` to return 404. | All six browser configurations |
| QA-007 (historic rollout) | Prior live loads briefly referenced missing assets; no infrastructure cause was established. Asset and runtime checks remain in the blocking browser suite. | Sanitized historic evidence: `tests/evidence/deployment-assets-20261024.json` |

Migrations 0005, 0006 and 0007 must be applied through the Supabase SQL editor before deploying the new assignment API, per `CLAUDE.md`. They preserve existing tables, event privacy, recipient freshness and forecasts. They prevent new partial posts; recipients of any historic interrupted post reconcile through their normal sync.

Two earlier cloud findings were not substantiated: the completion report compared nonlinear displayed score points with raw pressure points, and the recurring-event report treated a rolling seven-day forecast change as a series leak. Neither is counted as a confirmed defect here. A reduced-motion development hydration warning was also observed; the stylesheet includes a reduced-motion fallback, so it is a diagnostic observation rather than a claimed animation failure.

Still outside this automated gate: fresh Google OAuth consent/revocation, real recurring-event isolation, a real Brightspace school feed and the cloud webhook. The existing signed-in session was previously checked for Google refresh, source validation and mobile layout; those checks do not substitute for these unverified flows. Keep service credentials, QA passwords and browser states out of GitHub artifacts and source control.

## Execution record

On 2026-10-24, against main baseline `c635a3c`: the production build, type check and lint passed; Vitest reported 178 passed and five expected failures; all 162 regular browser cases passed with zero retries, skips or flaky cases. The three browser defects above were reproduced separately with failing assertions and saved screenshots/traces. Thirty-two SQL identities were created in the ephemeral database; no live Supabase users were provisioned. The repository had no Supabase credentials, no accessible connected Supabase project, and no TesterArmy webhook secret.

After pushing `d0e5145`, the live deployment run passed 161/162 cases and exposed QA-007. The failed gauge boundary passed three sequential rechecks after the rollout. An additional asset-health scenario was then added and passed across all six configurations against the production build, bringing the regular suite to 168 cases. Treat the rollout failure as a real captured deployment problem, not an additional successful run.


After the regression fixes, the production build, type check and lint passed. Vitest passed **274/274** tests across 33 files, with no expected failures. The production-browser suite passed **186/186** cases across all six configurations, with zero retries, skips or flaky tests. The first development pass exposed a reload assertion that did not reselect the demo team and a local WebKit origin mismatch; both were corrected before this final run.

Migrations **0005 and 0006 were applied through the Supabase SQL editor** to the project verified against the live app's sign-in destination. A read-only transaction checked the hidden-count contract for every existing membership in the live database. The atomic posting function is installed, executable by `service_role`, and inaccessible to `authenticated`; no user data was inserted or changed by that verification. Failure injection and rollback recovery were exercised only in ephemeral PostgreSQL.

Repository administration is separate from pushing code. The available GitHub CLI accounts lack admin permission, and the signed-in browser shows “You don't have access to repository options.” The owner setup command above is provided so required-check enforcement can be completed without changing credentials. Do not treat the workflow's presence as proof that branch protection is enabled.

A concurrent staging update added live QA-account verification and Apple Calendar setup. These changes were preserved in the integration; the final combined checks and signed-in privacy assertions are recorded below.


Final combined staging verification (including the concurrent Apple Calendar and live-QA changes): production build, lint and typecheck passed; **291/291** unit/database tests, **186/186** public browser cases and **64/64** signed-in cases across all 32 accounts passed, with zero retries or skips. Public and authenticated runners now use separate output directories. This prevents one suite from deleting the other suite's traces during teardown; an earlier concurrent run exposed that collision. A separate earlier trace also captured `ERR_NETWORK_CHANGED`. Both suites passed together after the runner fix. The single-session authenticated command passed its two checks as well.

GitHub's protection API returned HTTP 404 to the available non-admin account when applying the prepared rule. Main's required-check enforcement still needs the repository owner; the CI workflow and `qa:protect-main` helper are ready.


Concurrent main reconciliation: preserved the newer revision-based assignment comparison (migration 0007), stable recipient locking and automatic re-read/recompute after concurrency conflicts. The live database already has this migration installed. Preserved deployment asset recovery and its two browser regressions. The required QA gate and stricter no-flaky policy remain in place.

Revision-based main reconciliation passes 298 unit/database tests. The public suite now has 198 cases, including deployment recovery; the final combined run is recorded by the PR checks.

The deployment recovery guard ignores canceled assets from departing documents. All 18 targeted asset/recovery cases passed across six browser configurations after the WebKit navigation fix. The repository owner will enable the required-status rule later, as agreed.
After these repairs, the complete production-browser suite passed **198/198** cases across all six configurations, with no retries or skipped tests. **284/284 unit/database tests**, type checks, lint and the production build passed. Database tests cover mid-transaction rollback, same-draft idempotency, stale revision rejection, service-role execution and decimal serialization. A live service-role transaction fanned out to all 14 class members and was rolled back. The live hidden-count function was checked against every membership without persisting test changes.

The local QA army then passed **306/306 unit/database tests** and **204/204 browser cases**, including a new regression for navigation-cancelled assets. Its first full run exposed a Firefox reload caused by treating a cancelled asset request as a deployment failure. Recovery now confirms an HTTP asset failure before reloading. A repeat smoke run passed 66/66 cases before the new regression was added. A subsequent live run passed all 34 public/demo scenarios and all 32 existing account checks. The interactive dashboard was also verified by running and replaying a case from its interface. GitHub run [40126242427](https://github.com/dsdsouza/Boiler-hub/actions/runs/40126242427) passed all 306 unit/database and 204 browser checks on `1f2362b`; an earlier CI attempt failed during Google's font download before one browser shard could start.


## Whole workflows and stuck-step reports

Open **Check Whole Workflows.command**, or run:

```bash
pnpm qa:workflows --workers 4
pnpm qa:workflows --accounts --workers 8
pnpm qa:workflows --accounts --url https://boilerplate.zhomander.workers.dev --workers 8
```

The first command runs seven complete journeys on Chromium, Firefox, WebKit and a phone configuration: onboarding to a completed and reopened task; class and work teams from creation through a second person's assignment completion and visibility changes; failed task/status saves through successful recovery; connecting, testing and removing a calendar feed; calendar subscription consent through revocation; and a Pip conversation from a failed reply through retry, follow-up and starting a fresh conversation. These use actual app components in a disposable Next checkout with resettable simulated services. The harness route is never shipped and makes no calls to live data services. Fixture services exist in the browser, so their router adapter uses explicit fresh-page checkpoints instead of a production server refresh. These local journeys do not claim real backend create/join/assignment writes or a real Gemini response; the live personal journeys and existing API/database tests provide separate coverage.

`--accounts` additionally refreshes the existing 32 synthetic account sessions and runs each account through real onboarding, note persistence, task creation, resizing, completion, fresh-page persistence checks, permitted team navigation and source settings. The default live target is `https://boilerhub.work`; `--url` also accepts the verified Cloudflare origin shown above. Other account targets are rejected. These checks use the real application API and database. Each identity modifies only its unique temporary manual task and its own status; cleanup deletes that task, restores the original status, and verifies both. The live suite does not create teams, post assignments, change source connections or create private calendar subscriptions. Those full lifecycle mutations are covered by the resettable local journeys. Fresh Google consent, real calendar grants and external provider connectivity remain separate manual/integration checks.

Each goal is a named Playwright step with a bounded timeout. The generated `qa-runs/workflows-<run>/{local,live}/index.html` updates while a run is active. It shows every planned step, duration, last completed goal, the point where progress stopped, and cleanup outcome. A timed-out step is **stuck**; a failed assertion is **failed**; later goals are **blocked**. Interrupted, skipped, missing and incomplete journeys never pass. The process exits unsuccessfully if any journey cannot finish. The command also prints stopping points directly.

Public report summaries contain static step labels and outcomes, not authenticated error text. Detailed errors remain in `.qa/workflow-diagnostics/<run>/errors.json`; failed live screenshots remain in `.qa/workflow-live-artifacts/`. Sessions, private diagnostics and screenshot contents are excluded from published CI reports. Reports describe where a runner stopped; candidates must still be reproduced before being called app bugs.

`pnpm qa:army` and `pnpm qa:check` include local journeys. Account army runs also include the live personal journeys after session preparation. Feature-branch CI shards the local journeys with the browser checks and uploads a separate workflow report per shard. The explicitly dispatched authenticated workflow on trusted `main` also runs the live personal journeys on Cloudflare, uploads their sanitized summary, and deletes its private sessions and diagnostics. No retries or expected failures turn an unfinished journey green.

To verify the stuck detector itself, run a deliberate diagnostic separately:

```bash
QA_WORKFLOW_PROBE=1 QA_WORKFLOW_REPORT_DIR=qa-runs/workflow-probe pnpm test:workflows --project=chromium --workers=1
```

This command is **supposed to fail** at “Wait for the stuck task save,” block “Complete the task,” and complete cleanup. It is excluded from regular product checks and does not represent an app bug.

## UI consistency and screen evidence

Open **Check UI Consistency.command**, or run:

```bash
pnpm test:ui
QA_UI_REPORT_DIR=qa-runs/my-ui-check pnpm test:ui --workers=2
```

This runs 60 cases across desktop Chromium, Firefox and WebKit, a phone, a tablet and a narrow 320px viewport. It inspects the landing page, demo, help and calendar helper, plus the actual workload, team, source and onboarding components in the disposable local harness. It also checks wider May deadline labels with a fixed clock, long unbroken team names and visible validation/recovery states. The signed-in components use resettable fictional services; these checks do not claim live account, backend or provider coverage.

The checks flag horizontal overflow, off-page controls, clipped control labels, drift from shared field/card radii, smaller field text, short shared controls, the page background/font and missing keyboard focus indicators on enabled app controls and links. Focus inspection accepts a visible outline or a painted border change on the control or its surrounding group. The 44px control height is a project convention. Simple text contrast is measured against composited ancestor backgrounds. Gradients, images, translucent groups and unsupported paint formats are counted as unmeasured, rather than declared passing. A separate detector self-check injects broken styles and verifies that repairing them clears the findings.

Each inspected screen saves a full-page screenshot and element-level findings in `qa-runs/ui-latest/index.html` by default. The report records the stopping step if a screen fails to load or an inspection is interrupted. A failed, skipped, retried or incomplete case cannot pass the army stage. Screenshots contain only public fixture content and synthetic harness data: the UI configuration never accepts live authentication state. These checks do not replace human screenshot review, a complete accessibility audit or pixel-baseline comparisons.

Full `pnpm qa:army`, `pnpm qa:explore` and `pnpm qa:check` runs include this stage; `--quick` omits it. GitHub's blocking browser shards run the same cases and upload `ui-consistency-1`, `ui-consistency-2` and `ui-consistency-3` reports with screenshots for 14 days. Existing complete workflow and authenticated checks remain separate.

The component suite also checks the movable Pip companion. Its native touch cases are registered only in the Chromium projects, which support the required touch protocol; the other movement, boundary, cancellation and chat checks run in all four component configurations. Unsupported touch cases are not registered as skipped work, so a complete local army run can still require zero skipped cases.

On macOS and Linux, the component, workflow and UI suites allow the disposable server to shut down and remove its temporary app copy before forceful termination. Reports remain in the requested report directory.
