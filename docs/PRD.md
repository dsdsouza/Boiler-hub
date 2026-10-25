# Boilerplate — PRD & Build Plan

Oct 24, 2026

## Overview

Boilerplate (working name) turns each person's calendar and tasks into a live boiler, so teams, classes and managers can see who is near the red line before anyone blows. Meetings, deadlines and homework add pressure; finished tasks and free time vent it.

**Problem.** People cannot see the load others carry. Teachers stack assignments on a student who also has a job and three exams. Managers hand work to the person who looks free but is buried. Nobody has a shared, low-effort signal for capacity.

**Concept.** Connect Google Calendar, add tasks, and get a pressure gauge from 0 to 100. Join teams (a class or a work team) and choose who sees your gauge. Leads get an Engine Room view of every visible boiler, plus a preview of how a new assignment would move everyone's pressure.

**Theme fit (Steam & Steel).** The boiler is the product's core mechanic, not a skin: pressure, heat, release valves, a whistle at redline, and pipes that reroute load between boilers.

**One-line pitch.** "You can see everyone's calendar. You can't see their pressure. Boilerplate shows it, with their permission."

## Goals and non-goals

The goal is a live, hosted web app that a judge can open on a custom domain (boilerhub.work) and understand in under 30 seconds, with or without logging in.

**Goals (must ship)**

1. Google sign-in with Calendar read access, producing a real pressure score from the next 7 days.
2. An animated boiler for each person: needle, steam, shaking at high pressure, whistle at redline.
3. In-app tasks that add pressure and vent it when completed.
4. Teams (class or work) with invite codes, lead and member roles, and per-team visibility.
5. Personal status (Open for work, Heads down, Running hot, Away) shown beside the gauge.
6. Engine Room: the team view, sorted by pressure, respecting visibility.
7. Lead assignments with a pressure preview before posting.
8. A no-login demo mode with a seeded team, linked from the landing page.

**Non-goals (this hackathon)**

- Integrations beyond Google Calendar, except the stretch items in Features.
- Native mobile apps, push notifications, real-time sync via webhooks.
- Any claim of measuring mental health. The gauge measures load, not wellbeing.
- Google OAuth app verification. We run in Testing mode with listed test users.

**Success criteria for demo day**

- Live link works on the domain, on a phone and a laptop.
- Demo mode loads in under 3 seconds with no sign-in.
- At least 3 real team members connected with real calendars.
- The assign-and-preview moment works end to end on stage.

## Users, teams and visibility

One person has one boiler showing total pressure across their whole life, and joins any number of teams. Teams see the gauge and status only, never what is on anyone's calendar.

**Teams.** A team has a name, a type (`class` or `work`) and an invite code. The type only changes labels: Teacher/Students versus Lead/Members.

**Roles.**

| Role | Who | Can do |
| --- | --- | --- |
| Lead | Team creator, plus any co-leads they promote | See boilers set to Lead only or Everyone; post assignments with pressure preview; manage invite code |
| Member | Anyone who joins with the code | See boilers set to Everyone; set own visibility and status |

**Visibility (set per team, per person).**

| Level | Who sees your boiler in that team |
| --- | --- |
| Hidden | Nobody. Default on joining a team. |
| Lead only | Leads of that team |
| Everyone | All members of that team |

Leads set their own visibility the same way. Hidden members still count in a lead's anonymous aggregate ("2 hidden members"), never by name, and no hidden count (or total that would reveal one) is shown when fewer than two members are hidden.

**What a team can see.** Name, avatar, score (0 to 100), zone, status and status note, last-updated time, and category counts such as "9 meetings, 3 deadlines". Never event titles, attendees or times. Tiles show the update time as relative ("2 days ago"), dim after 24 hours and are labelled Stale after 72 hours; assignment previews list never-synced and stale visible members separately ("N members have no recent data") instead of counting them in the summary.

**Personal status.** Set by the person, shown beside the gauge, never changes the score.

| Status | Meaning |
| --- | --- |
| Open for work | Busy calendar, but I have room |
| Heads down | Focused, please don't add anything |
| Running hot | Check in with me |
| Away | Out or offline |

An optional status note of up to 80 characters goes with it.

## Features by screen

The MVP is six screens plus a demo mode; everything else is stretch.

| Screen | Route | MVP contents |
| --- | --- | --- |
| Landing | `/` | Animated hero boiler, one-line pitch, "Sign in with Google", large "Try the demo" button, link to How it works |
| Onboarding | `/onboarding` | Confirm Calendar connected, first sync, pick status, optional join-team code |
| My Boiler | `/boiler` | Large boiler and gauge; "Why is my needle here?" breakdown; 7-day forecast strip; tasks list with add/complete; per-event Light/Normal/Heavy tags with "apply to series"; Refresh button; status picker |
| My Teams | `/teams` | Team cards with own role and visibility per team; create team; join by code |
| Engine Room | `/teams/[id]` | Grid of boilers sorted by pressure; status flags; filter by zone and status; hidden-member count; lead-only "New assignment" panel |
| How it works | `/how` | The formula, weights and privacy promise in plain words |
| Demo | `/demo` | Engine Room and a sample My Boiler from fixtures, no auth, with a "you are viewing demo data" banner |

**Key interactions**

- Completing a task plays a steam-vent animation and the needle drops.
- Crossing 90 triggers the whistle (sound off by default, toggle in header) and a shake.
- Lead assignment flow: enter title, due date and size, see a preview ("Moves 4 members into Hot, 1 into Redline"), then post. The task appears on every member's task list as source `team`.
- Engine Room boilers show category counts on hover, never details.

**Stretch, in priority order**

1. ~~ICS feed URL import (Canvas, Outlook, Blackboard) as a task and event source.~~ Shipped, see Sources.
2. Browser extension mock: a floating gauge over Google Calendar, UI only, reading the demo or `/api/me/boiler`.
3. Pipe reroute: in the Engine Room, drag a team assignment from one member to another and watch both needles move.
4. ~~GitHub issues assigned to me as a task source, size from `size:S/M/L` labels.~~ Retired; see Sources.
5. Mood check-in modifier (plus or minus up to 10 points), owner-only.
6. Slack or Discord bot posting redline alerts.

## Sources

Tasks also come from external sources, not just manual entry. A supported source is an ICS feed (Brightspace, Canvas, Outlook, or another calendar), added at `/settings/sources` or in onboarding. Each sync fetches every supported source live and merges its items with the calendar and manual tasks; titles and due dates are never stored, only the owner's overrides.

**ICS.** Fetched with a 10 s timeout behind an SSRF guard (https only; the host and every address it resolves to must be public; redirects re-checked). Events in the next 7 days count. Deadlines in the next 14 days count, with another 7 days fetched for forecast preparation. New feed connections import deadlines dated today or later in the feed/owner time zone. That connection-day boundary stays fixed: imported work that later becomes overdue remains listed for up to 60 days; past 14 overdue days it keeps a reduced backlog weight and remains counted. Deadline-like entries (zero-length, a title with due, assignment, quiz, exam, midterm, final, project or lab, or all-day in a *coursework* feed) become tasks due at their time (all-day: 23:59 that day); sized by title, first match wins: L for exam, midterm or final; M for quiz, project, lab, paper, essay, report or presentation; S for homework, assignment, discussion, reading and everything else. Other timed entries become events and can be tagged Light/Normal/Heavy. Brightspace and Canvas feeds are coursework feeds by default. A first sync never guesses that overdue work is done. Owners review overdue assignments before bulk completion, and completed or cleared feed items remain available for individual restoration while present in the feed.

**Retired GitHub integration.** New GitHub connections and source tests are rejected. Sync, Pip and the deadline calendar ignore historical GitHub sources without decrypting or fetching them. Migration `20261025015300_retire_github_sources.sql` permanently removes every GitHub connection/token, its item overrides and any legacy GitHub task rows, and invalidates affected cached pressure readings. Check constraints block GitHub writes from both authenticated and service-role clients. Existing enum values remain for compatibility. Until the migration is applied, historical rows are shown disconnected and owner-removable. See [source connections](sources.md).

**Overrides and health.** Owners can mark source items done or undone and change their size; these live in `source_item_state`, keyed by a SHA-256 of the external id. A failing source is marked `error` with a readable message and skipped; it never fails the sync. Fetches are cached in memory for a few minutes per server instance (best-effort); Refresh bypasses the cache. Team assignment posts do not fetch anyone's calendar or sources: they update existing snapshots with the preview math (keeping each snapshot's original `computed_at`, and creating none for members who never synced), and each member's next sync reconciles.

| Table | Key columns | Notes |
| --- | --- | --- |
| `sources` | `id`, `user_id`, `kind` (ics, github), `label`, `secret_encrypted`, `coursework`, `last_synced_at`, `status` (ok, error), `error` | Owner-only; the encrypted URL or token is not selectable by clients |
| `source_item_state` | `user_id`, `source_id`, `item_key`, `done_at`, `size_override` | Owner-only overrides, no titles or dates |

| Method and path | Returns or does |
| --- | --- |
| `GET /api/sources`, `POST /api/sources` | List (no secrets); add a calendar feed after validating its URL |
| `DELETE /api/sources/[id]` | Remove a source and its overrides |
| `POST /api/sources/[id]/test` | Refetch a calendar feed and report the item count; retired integrations return 410 |
| `PATCH /api/sources/items` | Mark done or undone, set a size, or clear overdue items without a vent |

## Visual direction

The boiler is the product, so the UI track gets the most design time: a warm, tactile steampunk machine that feels alive, not a flat dashboard with a gauge icon.

**Look.** Dark iron and soot background in dark mode, parchment in light mode. Brushed steel and brass surfaces with rivets, copper pipes, a glowing firebox. Headings in a condensed industrial serif or slab (for example Bebas Neue or Rye for display, Inter for body). Numbers on gauges in a tabular mono.

**Motion that carries meaning**

| Element | Driven by | Behavior |
| --- | --- | --- |
| Sight glass bubbles | Score | A glass water tube on the boiler; bubble count, size and speed rise with pressure; at Redline it rolls to a full boil |
| Steam plumes | Score | Soft particle puffs from the stack and valves; denser and faster when hot |
| Needle | Score | Spring-eased swing with a slight overshoot and settle |
| Firebox glow | 7-day forecast | Brighter when the coming days are heavy ("the fire is already lit") |
| Shake and rattle | Zone | Off at Cool, subtle at Hot, strong at Redline |
| Vent burst | Task completed | A valve opens, a big steam cloud, bubbles calm down, needle drops |
| Whistle | Crossing 90 | Whistle animates, optional sound |
| Pipes | Engine Room | Faint steam flowing through pipes linking team boilers |

**Implementation.** SVG for the boiler body and gauge (crisp, themeable). A canvas layer (or tsParticles) for bubbles and steam so dozens of particles stay at 60fps. Framer Motion for the needle, shake and vent. All motion off under prefers-reduced-motion, with the score still readable as a number.

**Design workflow.** Iterate on the look in Claude Design (or as a Design artifact) before the UI track builds, then save the chosen mockups as images in `docs/design/` for the UI worktree to match.

## Pressure engine

Pressure is a pure, deterministic function of events over the next 7 days and tasks due over the next 14 days, plus unfinished overdue work, mapped to 0 to 100. It lives in `lib/pressure`, has no I/O, and is unit tested. All constants sit in one `config.ts` so they can be tuned in minutes.

**Inputs.** Every source (Google events, in-app tasks, team assignments, connected ICS feeds) is normalized to one `LoadItem` shape before it reaches the engine.

**Event filtering (from Google Calendar fields)**

- Skip: declined (`responseStatus: declined`), marked Free (`transparency: transparent`), all-day events, events already ended.
- Exclude from pressure: `eventType: focusTime` and `outOfOffice`; calendar availability never cancels unfinished tasks.
- Ignore: `eventType: workingLocation`.

**Weights**

| Factor | Value |
| --- | --- |
| Event weight tag | Light 0.25, Normal 1.0, Heavy 1.6 (user override, else default) |
| Default for recurring events | Light |
| Attendees | × (1 + 0.03 × min(attendees, 10)) |
| User is organizer | × 1.2 |
| Task size points | S 2, M 4, L 8 |
| Proximity (days from now, d) | 1 / (1 + 0.35 × d) |
| Task urgency | 1 / max(days until due, 0.25), capped at 3; overdue = 3 |
| Task with no due date | Treated as due 7 days from now (urgency 1/7) |
| Overdue aging | After 14 overdue days: urgency 0.5. Still counted as overdue until marked complete; manual items can also be removed |
| Completed task | Its own load is removed. It cannot cancel other unfinished tasks |
| Focus time or OOO | Excluded; no negative credit |
| Scale constant K | 8.5 |

These are the shipped values; `lib/pressure/config.ts` is the source of truth and every other number (UI, `/how`, teams preview) imports from it. Two were tuned from the original plan so the targets below hold: Light 0.5 → 0.25, so recurring rituals weigh well below one-off meetings, and K 25 → 8.5, so a typical student week lands near 55 and a 25-meeting-hour manager week near 78.

**Formula**

```
R = Σ_events (hours × weight × attendeeFactor × organizerFactor × proximity)
  + Σ_tasks  (sizePoints × urgency)

score = round(100 × (1 − e^(−max(R, 0) / K)))
```

The exponential curve means early load moves the needle fast and it never exceeds 100.

**Zones**

| Score | Zone | Boiler behavior |
| --- | --- | --- |
| 0 to 39 | Cool | Calm, light steam |
| 40 to 69 | Working | Steady steam |
| 70 to 89 | Hot | Shaking, heavy steam, amber gauge |
| 90 to 100 | Redline | Whistle, red glow, strong shake |

**Outputs.** `computePressure(items, now)` returns the score, raw R, zone, a per-item contribution list (for the owner's breakdown), category counts (for teams), and a 7-day forecast of daily scores (for the forecast strip).

**Assignment preview.** Stored snapshots keep raw R. Preview adds the new task's points at its due date to each member's R and re-maps, so no member calendar is re-read.

The tuning target: a typical student week with 5 classes and 3 assignments lands around 50; a manager with 25 meeting hours lands around 80.

## Data, API and Google integration

Calendar events are fetched live and never stored. The database holds people, teams, tasks, weight tags and one pressure snapshot per person; teams read only snapshots.

**Tables (Supabase Postgres)**

| Table | Key columns | Notes |
| --- | --- | --- |
| `profiles` | `id` (auth user), `name`, `avatar_url`, `status`, `status_note` | `status` enum: open, heads_down, running_hot, away |
| `teams` | `id`, `name`, `type`, `invite_code`, `created_by` | `type` enum: class, work; 6-character code |
| `memberships` | `team_id`, `user_id`, `role`, `visibility` | role: lead, member; visibility: hidden, lead, everyone; default hidden |
| `tasks` | `id`, `owner_id`, `title`, `due_at`, `size`, `done_at`, `source`, `assignment_id` | source: manual, team, ics, github |
| `team_assignments` | `id`, `team_id`, `title`, `due_at`, `size`, `created_by`, `client_key` | Fans out into one `tasks` row per member; `unique (team_id, client_key)` (0003) makes a repeated post of the same draft return the first assignment |
| `event_weights` | `user_id`, `series_key`, `weight` | `series_key` = SHA-256 of `recurringEventId` or event id |
| `pressure_snapshots` | `user_id`, `score`, `raw`, `zone`, `counts` (jsonb), `forecast` (jsonb), `computed_at` | One row per user, upserted on every sync |
| `google_tokens` | `user_id`, `refresh_token` (encrypted), `access_token`, `expires_at` | Server-only, no client access |

**Row-level security.** A member reads another person's snapshot and profile only through a Postgres function `team_boilers(team_id)` that applies visibility. Tasks, weights and tokens are owner-only.

**API routes (Next.js route handlers)**

| Method and path | Returns or does |
| --- | --- |
| `GET /api/me/boiler` | Live compute: score, zone, contributions, forecast, tasks, status |
| `POST /api/sync` | Fetch Google, compute, upsert snapshot |
| `POST /api/tasks`, `PATCH /api/tasks/[id]` | Create, edit, complete (sets `done_at`), then resync |
| `PUT /api/event-weights` | Set a tag for one event or a whole series |
| `PATCH /api/me/status` | Status and note |
| `GET /api/teams`, `POST /api/teams`, `POST /api/teams/join` | List, create, join by code |
| `PATCH /api/teams/[id]/membership` | Own visibility; leads can change roles |
| `GET /api/teams/[id]/engine-room` | Visible boilers plus hidden count |
| `POST /api/teams/[id]/assignments/preview` | Per-member before and after scores, zone changes |
| `POST /api/teams/[id]/assignments` | Create and fan out to members |

**Google OAuth plan**

1. Supabase Auth, Google provider, scopes `openid email profile https://www.googleapis.com/auth/calendar.readonly`, with `access_type=offline` and `prompt=consent` so a refresh token is issued.
2. In `/auth/callback`, read `provider_token` and `provider_refresh_token` from the session and store them in `google_tokens` (Supabase does not refresh Google tokens for you).
3. `lib/google/client.ts` refreshes the access token through `https://oauth2.googleapis.com/token` when it is within 5 minutes of expiry.
4. Fetch `calendars/primary/events` with `timeMin=now`, `timeMax=now+7d`, `singleEvents=true`, `orderBy=startTime`; normalize to `LoadItem`.
5. Sync on login, on the Refresh button, after task changes, when My Boiler loads with a snapshot older than 30 minutes, and once a day for everyone via the Vercel cron `GET /api/cron/resync` (authorized by `Authorization: Bearer $CRON_SECRET`).
6. If Google is unreachable for any reason other than a revoked or expired grant, the result is tasks-only with a "temporarily unavailable" banner and the snapshot is not saved.

**Google Cloud setup.** OAuth consent screen in Testing mode; add every teammate and any judge emails as test users (limit 100); authorized redirect URI is the Supabase callback; add `https://boilerhub.work` to authorized origins (`www.boilerhub.work` and `boiler-hub.vercel.app` 308-redirect to it). Testing-mode refresh tokens expire after 7 days, which is fine for the event.

**Privacy promise (for the pitch and How it works).** We never store what is on your calendar. Teams see a number, a zone and your status, only if you choose. You can hide from any team at any time.

## Environment and accounts

All worktrees share one Supabase project, one Google OAuth client and one `.env.local`, symlinked from the main checkout. Only `.env.example` (names, no values) is committed.

| Variable | Where it comes from | Exposed to browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings, API section | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API keys, anon (publishable) key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API keys, service role (secret) key | No |
| `GOOGLE_CLIENT_ID` | Google Cloud, Credentials, OAuth client (web) | No |
| `GOOGLE_CLIENT_SECRET` | Same OAuth client | No |
| `TOKEN_ENCRYPTION_KEY` | Generate: `openssl rand -base64 32` | No |
| `CRON_SECRET` | Generate: `openssl rand -hex 32`; Vercel sends it to the daily cron | No |

**Site URL.** No site-URL variable is needed: sign-in, the auth callback and sign-out build their redirects from the request's own origin. Production is `https://boilerhub.work`; `www.boilerhub.work` and `boiler-hub.vercel.app` redirect to it permanently (308), so sign-in cookies live on one host. Supabase's Site URL and allowed redirect URLs, and the Google OAuth client's authorized origins, list `https://boilerhub.work`.

**Local ports.** Engine on 3000, UI on 3001, Teams on 3002. Each `http://localhost:300X/auth/callback` must be in Supabase's allowed redirect URLs and each origin in the Google OAuth client.

**Production.** The same variables go into Vercel project settings; `vercel env pull .env.local` regenerates the local file if it is lost.

## Stack, repo layout and contracts

Next.js (App Router, TypeScript) with Tailwind, Supabase for auth and Postgres, deployed on Vercel with boilerhub.work pointed at it. The shared types below are written first and frozen, so parallel worktrees can build against them without colliding.

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 15, App Router, TypeScript strict | UI and API in one deploy |
| Styling | Tailwind, plus hand-written SVG for the boiler | Steampunk look without a heavy 3D library |
| Animation | Framer Motion | Needle swing, shake, steam particles |
| Auth and DB | Supabase (Google provider, Postgres, RLS) | Auth and DB in about an hour |
| Calendar | Google Calendar REST via `fetch` | No SDK needed for one endpoint |
| Tests | Vitest for `lib/pressure` | Engine correctness without UI |
| Hosting | Vercel, custom domain boilerhub.work from GoDaddy (CNAME and A records) | Fastest deploy; open question on sponsor rules below |

**Repo layout**

```text
app/
  page.tsx                 landing
  demo/                    no-auth demo
  onboarding/
  boiler/                  My Boiler
  teams/  teams/[id]/      My Teams, Engine Room
  how/
  auth/callback/route.ts
  api/...                  routes listed in Data, API section
components/
  boiler/                  Boiler.tsx, Gauge.tsx, Steam.tsx, Whistle.ts
  ui/                      shared buttons, cards, status pill
lib/
  types.ts                 FROZEN shared contract
  pressure/                engine, config.ts, tests
  google/                  tokens, calendar fetch, normalize
  supabase/                server and browser clients
  data/                    query helpers per table
fixtures/demo.json         seeded team and boilers
supabase/migrations/
docs/PRD.md                this file
docs/design/               mockups for the UI track
CLAUDE.md                  rules every Claude Code instance follows
```

**Frozen contract (`lib/types.ts`)**

```ts
export type Zone = 'cool' | 'working' | 'hot' | 'redline';
export type Weight = 'light' | 'normal' | 'heavy';
export type Size = 'S' | 'M' | 'L';
export type Status = 'open' | 'heads_down' | 'running_hot' | 'away';
export type Visibility = 'hidden' | 'lead' | 'everyone';
export type Role = 'lead' | 'member';
export type Source = 'google' | 'manual' | 'team' | 'ics' | 'github';

export interface LoadItem {
  id: string;
  kind: 'event' | 'task';
  source: Source;
  title: string;
  start?: string; end?: string;   // ISO, events
  due?: string;                   // ISO, tasks
  doneAt?: string | null;
  size?: Size;
  weight?: Weight;                // resolved tag
  seriesKey?: string;
  attendees?: number;
  isOrganizer?: boolean;
  isRecurring?: boolean;
  release?: boolean;              // focus time, OOO
}

export interface Contribution { itemId: string; title: string; points: number; reason: string; }
export interface Counts { meetings: number; meetingHours: number; tasksDue: number; overdue: number; }
export interface ForecastDay { date: string; score: number; zone: Zone; }

export interface PressureResult {
  score: number; raw: number; zone: Zone;
  contributions: Contribution[]; counts: Counts; forecast: ForecastDay[];
}

export interface BoilerCard {          // what a team member sees
  userId: string; name: string; avatarUrl?: string;
  score: number; zone: Zone; status: Status; statusNote?: string;
  counts: Counts; updatedAt: string;
}

export interface EngineRoom {
  team: { id: string; name: string; type: 'class' | 'work' };
  myRole: Role;
  boilers: BoilerCard[];
  hiddenCount: number;
}

export interface AssignmentPreview {
  members: { userId: string; name: string; before: number; after: number; zoneBefore: Zone; zoneAfter: Zone }[];
  hidden: { count: number; intoRedline: number };
}
```

**CLAUDE.md rules.** Never edit `lib/types.ts` without the human's approval. Stay inside your worktree's owned folders. Use `fixtures/demo.json` when real data is not wired yet. Run `pnpm typecheck && pnpm test` before every commit. Small commits with a prefix per track: `engine:`, `ui:`, `teams:`.

## 33-hour build plan

Four Claude Code sessions are enough: one Foundation on main, three parallel worktrees, then Integration on main. More tracks would collide on the same files for little gain.

| Hours | Work | Where |
| --- | --- | --- |
| 0–3 | 0. Foundation | main |
| 3–13 | A. Engine + Google | worktree `track/engine` |
| 3–13 | B. Boiler UI | worktree `track/ui` |
| 3–13 | C. Teams + Engine Room | worktree `track/teams` |
| 13–17 | D. Merge + integration | main |
| 17–21 | Rest (recommended) | — |
| 21–25 | Tune formula, polish | main |
| 25–29 | Stretch: ICS, extension mock | main |
| 29 | **Code freeze** | — |
| 29–31 | Domain, test users, QA | main |
| 31–33 | Pitch + backup video | — |

Foundation must merge before any worktree starts, because it freezes `lib/types.ts` and the schema. Merge the tracks in order engine, ui, teams, since teams imports the engine's preview helper and the UI's boiler. Nothing new starts after the hour-29 freeze; only fixes.

**Your role while tracks run.** Review each track's commits every hour or two, run the Google Cloud and Supabase setup by hand, collect judge emails for test users, and confirm the boilerhub.work DNS early, since propagation can take hours.

## Claude Code handoffs

Run Foundation alone on `main` first, then open three worktrees in parallel, then one Integration session on `main`. Commit this file to `docs/PRD.md` before Foundation.

**Worktree setup (after Foundation is merged)**

```bash
git worktree add ../bp-engine -b track/engine
git worktree add ../bp-ui     -b track/ui
git worktree add ../bp-teams  -b track/teams
# in each worktree folder: share one env file, then start
ln -s ../boilerplate/.env.local .env.local && pnpm install && claude
# run each on its own port: pnpm dev -p 3001 (ui), -p 3002 (teams)
```

**0. Foundation (on main, one instance, about 3 hours)**

```text
You are setting up the foundation for Boilerplate, a hackathon web app. Read docs/PRD.md fully first.

Goal: a deployable skeleton that three parallel worktrees can build on without touching the same files.

Do:
1. Scaffold Next.js 15 (App Router, TypeScript strict, Tailwind, pnpm). Add Framer Motion and Vitest. Add scripts: dev, build, typecheck, test.
2. Create lib/types.ts exactly as in the PRD section "Stack, repo layout and contracts". This file is frozen after you finish.
3. Create the folder layout from the PRD with placeholder pages for /, /demo, /onboarding, /boiler, /teams, /teams/[id], /how. Each placeholder renders its title.
4. Supabase: write supabase/migrations/0001_init.sql with every table, enum and index from the PRD "Data, API and Google integration" section, RLS enabled on all tables, owner-only policies, and the team_boilers(team_id uuid) SECURITY DEFINER function that applies visibility rules. Add lib/supabase/server.ts and lib/supabase/browser.ts using @supabase/ssr.
5. Auth: Google sign-in via Supabase with scopes openid email profile https://www.googleapis.com/auth/calendar.readonly, queryParams access_type=offline and prompt=consent. app/auth/callback/route.ts exchanges the code and upserts provider_token, provider_refresh_token and expiry into google_tokens (server-only). Middleware protects /boiler, /teams and /onboarding.
6. fixtures/demo.json: one work team "Product Squad" with 6 members and one class "AP Bio P3" with 8 students. Each member has a BoilerCard (spread across all four zones, mixed statuses and notes) and, for one member "Maya", a full PressureResult with 12 contributions and a 7-day forecast.
7. Write CLAUDE.md with the rules in the PRD (frozen types, owned folders, typecheck and test before commit, commit prefixes) and a short "Track ownership" table: engine owns lib/pressure, lib/google, app/api/me, app/api/sync, app/api/tasks, app/api/event-weights; ui owns components/boiler, components/ui, app/page.tsx, app/boiler, app/how, app/demo; teams owns app/teams, app/api/teams, lib/data/teams.ts.
8. .env.example listing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY. (NEXT_PUBLIC_SITE_URL was in the original list; it was removed later because nothing reads it: auth uses the request origin.)

Done when: pnpm build passes, sign-in with Google works locally and a google_tokens row appears, every route renders its placeholder, and the app is deployed to Vercel. Ask me before choosing anything the PRD does not specify.
```

**A. Engine and Google (`track/engine`)**

```text
Read docs/PRD.md and CLAUDE.md. You own: lib/pressure, lib/google, app/api/me, app/api/sync, app/api/tasks, app/api/event-weights. Do not edit lib/types.ts or other tracks' folders.

Build:
1. lib/pressure/config.ts with every constant from the PRD "Pressure engine" section.
2. lib/pressure/compute.ts: computePressure(items: LoadItem[], now: Date): PressureResult. Pure, no I/O. Implement filtering, weights, proximity, urgency, completion, the exponential mapping, zones, contributions with human reasons ("2h review, 9 people, Heavy"), counts, and a 7-day forecast (score as of the start of each day).
3. Vitest tests: empty week is 0 and cool; declined and transparent events ignored; focus time cannot erase pending tasks; completing a task removes only its own load; a typical student week is 40 to 60; a 25-meeting-hour manager week is 75 to 85; score never exceeds 100.
4. lib/google: token refresh, fetch primary calendar for now to now+7d (singleEvents=true), normalize to LoadItem (attendees count, organizer.self, recurringEventId to seriesKey via SHA-256, eventType focusTime/outOfOffice to release, skip workingLocation).
5. Routes: GET /api/me/boiler (live compute plus tasks plus status), POST /api/sync (compute and upsert pressure_snapshots), POST and PATCH /api/tasks (complete sets done_at, then resync), PUT /api/event-weights (single event or series), PATCH /api/me/status.
6. Export a helper lib/pressure/preview.ts: applyTaskToRaw(raw: number, task: {due: string; size: Size}, now: Date) returning the new score and zone, for the teams track.

Done when: tests pass, and hitting /api/me/boiler while signed in returns a real PressureResult from my calendar. Commit with prefix engine:.
```

**B. Boiler UI (`track/ui`)**

```text
Read docs/PRD.md and CLAUDE.md. You own: components/boiler, components/ui, app/page.tsx, app/boiler, app/how, app/demo. Build against fixtures/demo.json until the engine track merges; fetch from /api/me/boiler behind a single data hook so swapping is one line.

Build:
1. components/boiler/Boiler.tsx: hand-made SVG steampunk boiler (riveted steel body, brass gauge, pipes, firebox glow). Props: score, zone, size ('sm' | 'lg'), status, animate. Needle eases to the score. Steam particle density scales with score. Shake at Hot, strong shake plus red glow at Redline. Add the sight-glass bubbles, firebox glow and other motion from the PRD section "Visual direction", using a canvas particle layer for bubbles and steam. Match any mockups in docs/design/. Respect prefers-reduced-motion.
2. Whistle and vent: a short whistle when crossing 90 (sound off by default, header toggle), a steam burst when a task completes.
3. components/ui: StatusPill, ZoneBadge, Card, Button in a steel and brass palette with light and dark themes.
4. /boiler: large boiler, "Why is my needle here?" breakdown sorted by points, 7-day forecast strip, task list with add (title, due, size) and complete, per-event Light/Normal/Heavy toggle with "apply to series", Refresh, status picker with note.
5. / landing: hero boiler that idles, pitch line, Sign in with Google, a large "Try the demo" button.
6. /demo: renders an Engine Room-style grid of fixture boilers plus Maya's full boiler, with a demo banner. No auth.
7. /how: the formula, weights table and privacy promise from the PRD.

Done when: /demo and /boiler look finished on a 390px phone and a laptop, animations run at 60fps, and Lighthouse accessibility is 90 or higher. Commit with prefix ui:.
```

**C. Teams and Engine Room (`track/teams`)**

```text
Read docs/PRD.md and CLAUDE.md. You own: app/teams, app/api/teams, lib/data/teams.ts. Import Boiler from components/boiler if it exists; otherwise use a simple placeholder gauge in app/teams/_placeholder.tsx and leave a TODO to swap it.

Build:
1. API: GET /api/teams (my teams with my role and visibility), POST /api/teams (creator becomes lead, generate a unique 6-character invite code), POST /api/teams/join (code; default visibility hidden), PATCH /api/teams/[id]/membership (own visibility; leads may promote co-leads).
2. GET /api/teams/[id]/engine-room: returns EngineRoom using the team_boilers function only, never raw tables, plus hiddenCount.
3. Assignments: POST /api/teams/[id]/assignments/preview returns AssignmentPreview using applyTaskToRaw from lib/pressure/preview.ts (stub it locally with the same signature if the engine track has not merged). POST /api/teams/[id]/assignments creates the assignment and one tasks row per member with source 'team', then triggers each member's resync.
4. /teams: team cards, create team, join by code, visibility selector per team with a one-line explanation of each level.
5. /teams/[id]: Engine Room grid sorted by score, filters by zone and status, hidden count, hover shows counts only. Leads see a "New assignment" panel: title, due, size, live preview summary ("Moves 4 into Hot, 1 into Redline") with before/after per member, then Post.
6. Write SQL tests or a script proving a member cannot read a hidden member's snapshot and a non-lead cannot read lead-only snapshots.

Done when: two real accounts can create, join, toggle visibility and see each other correctly, and the assignment preview matches the posted result. Commit with prefix teams:.
```

**D. Integration (on main, one instance, after all three merge)**

```text
Read docs/PRD.md and CLAUDE.md. Tracks engine, ui and teams are merged. Wire everything together: replace fixture hooks with real API calls on /boiler; replace any placeholder gauge in /teams with components/boiler; build /onboarding (connect, first sync, status, optional join code); make sure task completion triggers the vent animation and resync. Then run a full pass on a phone and a laptop: sign in, sync, add and complete a task, create a team, join from a second account, change visibility, post an assignment. Fix every bug you find, keep a list in docs/QA.md, and redeploy.
```

## Demo script, risks and open questions

The demo is 3 minutes, built around one moment: a lead previews an assignment and watches boilers go red before posting it.

**Demo script**

1. (0:00) Problem: "You can see everyone's calendar. You can't see their pressure."
2. (0:20) My Boiler, live from a real Google Calendar. Open "Why is my needle here?" and tag a standup as Light; the needle drops.
3. (0:50) Complete a task: steam vents, needle falls.
4. (1:10) Engine Room for AP Bio P3: three students in Hot, one whistling in Redline marked "Running hot". One student is Hidden and appears only as a count.
5. (1:40) As the teacher, draft a lab report due Friday. Preview: "Moves 3 into Hot, 2 into Redline." Push the due date to next Tuesday; preview: "1 into Hot." Post it.
6. (2:20) Privacy promise and visibility levels in one slide.
7. (2:40) Live link on boilerhub.work, QR code, "Try the demo".

**Risks and fallbacks**

| Risk | Fallback |
| --- | --- |
| Judges blocked by Google Testing mode | "Try the demo" on the landing page; collect judge emails early and add them as test users |
| Venue Wi-Fi fails during the live demo | Run the demo route from fixtures; record a 90-second backup video by hour 30 |
| Score feels wrong on real calendars | All constants in one config file; tune with the team's real weeks at the integration step |
| Worktree merge conflicts | Frozen types, owned folders, merge one track at a time: engine, then ui, then teams |
| Supabase does not refresh Google tokens | Own refresh logic in lib/google, specified in the Engine handoff |
| Scope creep | Stretch list is strictly ordered; nothing starts before the MVP passes the QA run |

**Open questions**

- [ ] Does the GoDaddy sponsor prize require GoDaddy hosting, or is a GoDaddy domain pointed at Vercel enough?
- [ ] Final product name and domain (Boilerplate, Redline, Steamworks).
- [ ] Can we get judge emails before judging to add as Google test users?

**Pitch "next steps" slide.** More coursework providers through the same LoadItem adapter; browser extension; Slack alerts; Google verification for public launch.
