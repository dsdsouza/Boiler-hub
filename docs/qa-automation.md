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

There are 27 public/demo scenarios across six configurations: Chromium, Firefox, WebKit, 390px mobile Chromium, 768px tablet Chromium, and 320px narrow Chromium (162 cases). Each case gets an isolated browser context. Local execution uses four workers; GitHub uses three shards with two workers each. These are desktop engines and viewport emulation, not real phones or iPads.

The default command starts its own local server on port 3100. The placeholder Supabase URL/key support signed-out checks only; they do not access a real database. To check a production build, build with the same public environment values and set `PLAYWRIGHT_PRODUCTION=1`. To test an existing deployment without starting a server:

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

`Boilerplate QA` runs on main pushes, pull requests and manual dispatch. It checks types, lint, unit/database contracts and all 162 regular browser cases. Reports are merged into a downloadable `browser-report` artifact; failed cases include traces and screenshots. The `known-issues` job is deliberately nonblocking and uploads red assertions as evidence. A green overall workflow does not mean these defects are fixed.

Vitest uses `it.fails` for the database/date/recovery defects below. Its summary reports them as **expected fail**, separate from passed tests; an unexpected pass makes that contract fail so the quarantine must be removed when the product is fixed. Browser defects use `@known-issue` and are excluded from the regular gate. Run them explicitly with:

```sh
pnpm test:e2e:known --project=desktop-chromium
```

## TesterArmy

Project: Boilerplate (`RMqKVQlZMsQ_`), target `https://boilerhub.work/`. Twenty saved tests are versioned in `tests/testerarmy/suite.json`, including public, demo and mobile/tablet groups. The 2026-10-24 cloud account exhausted its five monthly runs and permits one concurrent run. Extra local/GitHub workers do not increase that quota.

The manual `TesterArmy cloud regression` workflow is ready to queue a saved group after a deployment. To activate it, enable Webhook in the chosen group's menu and save the generated URL as the GitHub Actions repository secret `TESTERARMY_GROUP_WEBHOOK_URL`. This secret has **not** been configured by this setup. The URL is never committed or logged. The workflow validates its destination, passes the commit/target/environment, and reports acceptance separately from actual test completion. See [TesterArmy group webhooks](https://docs.tester.army/run/group-webhooks).

## Reproduced findings, 2026-10-24

| ID | Impact and reproduction | Evidence / scope |
| --- | --- | --- |
| QA-001 | In `/demo`, change Maya's personal status to Away and save a note, then inspect Maya in Product Squad: the team card keeps the original status/note. | Browser assertion in `known-issues.spec.ts`; demo state synchronization only. No evidence that live accounts share the defect. |
| QA-002 | The task form offers Today, Tomorrow, In 3 days and In a week, with no undated choice, although the API accepts null and formula documentation describes undated tasks. | Browser assertion; UI capability gap. The original cloud task run substituted Tomorrow and its pass does not cover this requirement. |
| QA-003 | An authenticated member can call `team_hidden_count` directly and get a count; a lead can get an exact count of one. The PRD reserves anonymous aggregates for leads and suppresses counts below two. | Two expected failures against the shipped SQL function and grants. The API's safer presentation does not protect the direct Supabase RPC. Production schema deployment was not inspected. A repair needs a new migration, applied by a human per repository policy. |
| QA-004 — resolved | Completed tasks now add no load or negative credit. Resizing a completed task leaves other assignments unchanged. | Promoted to the normal demo regression suite with the completed-task review disclosure. |
| QA-005 | `parseDue('1')` becomes January 2001 and `parseDue('01/02/2030')` is accepted with a locale-ambiguous interpretation despite the API promising an ISO date-time. | Two expected-failure date contract tests. Wrong-date risk, not a demonstrated security exploit. |
| QA-006 | When recipient tasks save but the following snapshot write fails, retrying the same assignment draft finds the duplicate and returns without repairing scores. | Fault-injection contract test calls the real `createAssignment` helper twice. No production outage is claimed; this demonstrates the recovery path. |

Two earlier cloud findings were not substantiated: the completion report compared nonlinear displayed score points with raw pressure points, and the recurring-event report treated a rolling seven-day forecast change as a series leak. Neither is counted as a confirmed defect here. A reduced-motion development hydration warning was also observed; the stylesheet includes a reduced-motion fallback, so it is a diagnostic observation rather than a claimed animation failure.

Still unverified without real project access: live account creation, Google OAuth/calendar refresh and revocation, real recurring event isolation, authenticated API authorization end-to-end, and the cloud webhook. Keep service credentials, QA passwords and browser states out of GitHub artifacts and source control.

## Execution record

On 2026-10-24, against main baseline `c635a3c`: the production build, type check and lint passed; Vitest reported 178 passed and five expected failures; all 162 regular browser cases passed with zero retries, skips or flaky cases. The three browser defects above were reproduced separately with failing assertions and saved screenshots/traces. Thirty-two SQL identities were created in the ephemeral database; no live Supabase users were provisioned. The repository had no Supabase credentials, no accessible connected Supabase project, and no TesterArmy webhook secret.
