# CLAUDE.md

Boilerplate: a hackathon web app that turns calendars and tasks into a live pressure gauge. The full spec is in `docs/PRD.md`. Read it before starting.

Stack: Next.js 15 (App Router, TypeScript strict), Tailwind v4, Framer Motion, Supabase (`@supabase/ssr`), Vitest, pnpm, Vercel.

## Rules

1. **`lib/types.ts` is frozen.** Never edit it without the human's approval. If you need a new shape, define it locally in your own folder.
2. **Stay inside your track's owned folders** (table below). If you need something outside them, stub it locally with the same signature and leave a `TODO(merge)` comment.
3. **Use `fixtures/demo.json`** when real data is not wired yet.
4. **Run `pnpm typecheck && pnpm test` before every commit.** Both must pass.
5. **Small commits with a track prefix:** `engine:`, `ui:`, `teams:`, `sources:` (Foundation and Integration use `foundation:` / `integration:`).
6. **The admin client bypasses RLS.** Every route that uses `createAdminClient()` from `lib/supabase/admin.ts` MUST first get the caller with the user client (`lib/supabase/server.ts`) and verify their membership or role for the specific team or resource before reading or writing. Never return another user's raw data, tasks, calendar or tokens.
7. **Never store calendar event contents.** Events are fetched live, and only snapshots are persisted.
8. **Do not change the schema** (`supabase/migrations/0001_init.sql`) without the human's approval. New migrations are numbered `0002_…` and must be applied by hand in the Supabase SQL editor.

## Track ownership

| Track | Owns |
| --- | --- |
| engine | `lib/pressure`, `lib/google`, `app/api/me`, `app/api/sync`, `app/api/tasks`, `app/api/event-weights` |
| ui | `components/boiler`, `components/ui`, `app/page.tsx`, `app/boiler`, `app/how`, `app/demo`, `app/layout.tsx`, `app/globals.css` |
| teams | `app/teams`, `app/api/teams`, `lib/data/teams.ts` |
| sources | `lib/sources`, `app/api/sources`, `app/settings`, `components/sources` |
| foundation / integration (main only) | everything else: `lib/types.ts`, `lib/supabase`, `lib/crypto.ts`, `lib/auth.ts`, `app/auth`, `app/onboarding`, `app/privacy`, `middleware.ts`, `supabase/`, `fixtures/`, `scripts/`, config files |

### Current parallel tracks (data / tasks-ui)

These override the table above for `track/data` and `track/tasks-ui`.

- **Nobody on these tracks edits `lib/pressure/compute.ts` or `lib/pressure/config.ts`.** A teammate is fixing the release math there.
- **track/data** (worktree `../bp-data`) owns `lib/sources`, `lib/google`, `app/api/tasks`, `app/api/sources`, `components/sources`, `supabase/migrations`.
- **track/tasks-ui** (worktree `../bp-tasks-ui`) owns `components/boiler` (TaskList, the forecast strip, MyBoilerView) and `app/boiler`.
- The optional `course` label on `Task` and `OwnerEvent` in `lib/pressure/api-types.ts` is the contract between them: data fills it, tasks-ui renders it, and both treat it as possibly absent.

## Visual source of truth (ui track)

`docs/design/` holds the chosen designs and is the UI track's visual source of truth. Start with `docs/design/README.md`: it lists each screen's template (`*.dc.html`), the fonts and the palette tokens. The `.dc.html` files are design templates, not runnable pages; rebuild them as React components and match their layout, copy, SVG geometry and colors. Other tracks should reuse `components/ui` once it exists rather than restyling. Only the human edits `docs/design/`.

## Shared building blocks (read-only for tracks)

- `lib/supabase/server.ts`: `createClient()`, the per-request user client (RLS applies). Use it in route handlers and server components.
- `lib/supabase/browser.ts`: `createClient()` for client components.
- `lib/supabase/admin.ts`: `createAdminClient()`, the service-role client. Server only. See rule 6.
- `lib/crypto.ts`: `encrypt` / `decrypt` (AES-256-GCM). `google_tokens.refresh_token` is stored encrypted.
- `/auth/signin` (GET, optional `?next=`) starts Google sign-in. `/auth/signout` (POST) signs out.
- `middleware.ts` protects `/boiler`, `/teams` and `/onboarding`.

### Database access (see `supabase/migrations/0001_init.sql`)

- Direct table access is owner-only: own `profiles`, `tasks`, `event_weights`, `pressure_snapshots` and own `memberships` rows (only `visibility` is updatable).
- `rpc('team_boilers', { team_id })` returns the BoilerCard rows the caller may see. `score`, `zone`, `counts` and `updated_at` are null if a member has never synced.
- `rpc('team_hidden_count', { team_id })` returns the number of members the caller cannot see.
- `rpc('create_team', { name, type })` creates the team and the caller's lead membership, and returns the team row with a 6-char `invite_code`.
- `rpc('join_team', { code })` joins as a hidden member and returns the team id.
- These go through the admin client after a lead check: role changes, assignment fan-out to `tasks`, reading `pressure_snapshots.raw` for assignment preview (hidden members appear only as counts), and, when an assignment posts, upserting each recipient's `pressure_snapshots` row (score, raw, zone, counts) with the same preview math so the posted result matches the preview. Posting makes no external calls (no calendar or source fetch per recipient), so the posted result matches the preview exactly; each member's own next `syncUser` (`lib/google/sync.ts`) does the full recompute.
- After a membership check (any role), the Engine Room uses the admin client only to read `memberships.role` for members the caller can already see via `team_boilers`, to tag leads.
- `google_tokens` is service-role only.
- `sources` and `source_item_state` (0002) are owner-only. Clients cannot select `sources.secret_encrypted` (column grants); only the server reads it, after an ownership check, via the admin client. Status writes during sync also use the admin client, scoped to the user. Source item titles and dates are fetched live in `syncUser` and never stored.

### Fixture shape (`fixtures/demo.json`)

```ts
{
  teams: Array<EngineRoom & { boilers: Array<BoilerCard & { raw: number }>; hiddenRaw: number[] }>;
  maya: { userId: string; result: PressureResult };
}
```

Every `raw` is derived from its score with the engine's `K`. After retuning `lib/pressure/config.ts`, run `node scripts/gen-demo-fixture.mts`; `fixtures/demo.test.ts` fails until you do.

### Pressure numbers have one source

All formula constants live in `lib/pressure/config.ts` and the math in `lib/pressure` (`scoreFromRaw`, `rawFromScore`, `taskPoints`, `applyTaskToRaw`, `zoneFor`). The UI's optimistic updates, `/demo`, `/how`, zone thresholds (`components/ui/zones.ts`) and the teams preview all import from there. Never copy a constant.

## Commands

```bash
pnpm dev            # localhost:3000 (ui: -p 3001, teams: -p 3002)
pnpm build
pnpm typecheck
pnpm test
```

Environment variables are listed in `.env.example`. Worktrees symlink `.env.local` from the main checkout.
