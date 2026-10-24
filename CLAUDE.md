# CLAUDE.md

Boilerplate: a hackathon web app that turns calendars and tasks into a live pressure gauge. The full spec is in `docs/PRD.md`. Read it before starting.

Stack: Next.js 15 (App Router, TypeScript strict), Tailwind v4, Framer Motion, Supabase (`@supabase/ssr`), Vitest, pnpm, Vercel.

## Rules

1. **`lib/types.ts` is frozen.** Never edit it without the human's approval. If you need a new shape, define it locally in your own folder.
2. **Stay inside your track's owned folders** (table below). If you need something outside them, stub it locally with the same signature and leave a `TODO(merge)` comment.
3. **Use `fixtures/demo.json`** when real data is not wired yet.
4. **Run `pnpm typecheck && pnpm test` before every commit.** Both must pass.
5. **Small commits with a track prefix:** `engine:`, `ui:`, `teams:` (Foundation and Integration use `foundation:` / `integration:`).
6. **The admin client bypasses RLS.** Every route that uses `createAdminClient()` from `lib/supabase/admin.ts` MUST first get the caller with the user client (`lib/supabase/server.ts`) and verify their membership or role for the specific team or resource before reading or writing. Never return another user's raw data, tasks, calendar or tokens.
7. **Never store calendar event contents.** Events are fetched live, and only snapshots are persisted.
8. **Do not change the schema** (`supabase/migrations/0001_init.sql`) without the human's approval. New migrations are numbered `0002_…` and must be applied by hand in the Supabase SQL editor.

## Track ownership

| Track | Owns |
| --- | --- |
| engine | `lib/pressure`, `lib/google`, `app/api/me`, `app/api/sync`, `app/api/tasks`, `app/api/event-weights` |
| ui | `components/boiler`, `components/ui`, `app/page.tsx`, `app/boiler`, `app/how`, `app/demo`, `app/layout.tsx`, `app/globals.css` |
| teams | `app/teams`, `app/api/teams`, `lib/data/teams.ts` |
| foundation / integration (main only) | everything else: `lib/types.ts`, `lib/supabase`, `lib/crypto.ts`, `lib/auth.ts`, `app/auth`, `app/onboarding`, `middleware.ts`, `supabase/`, `fixtures/`, config files |

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
- These go through the admin client after a lead check: role changes, assignment fan-out to `tasks`, reading `pressure_snapshots.raw` for assignment preview (hidden members appear only as counts), and, when an assignment posts, upserting each recipient's `pressure_snapshots` row (score, raw, zone, counts) with the same preview math so the posted result matches the preview. The last one is a teams-track stand-in until the engine's `syncUser` does a full recompute.
- After a membership check (any role), the Engine Room uses the admin client only to read `memberships.role` for members the caller can already see via `team_boilers`, to tag leads.
- `google_tokens` is service-role only.

### Fixture shape (`fixtures/demo.json`)

```ts
{
  teams: Array<EngineRoom & { boilers: Array<BoilerCard & { raw: number }>; hiddenRaw: number[] }>;
  maya: { userId: string; result: PressureResult };
}
```

## Commands

```bash
pnpm dev            # localhost:3000 (ui: -p 3001, teams: -p 3002)
pnpm build
pnpm typecheck
pnpm test
```

Environment variables are listed in `.env.example`. Worktrees symlink `.env.local` from the main checkout.
