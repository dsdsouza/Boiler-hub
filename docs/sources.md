# Source connections

Connect has two connection tabs: **Class schedule** and **Calendar feed**. Both preserve form drafts when switching tabs. Each shows **How to find your school calendar link** in place of the former description and inline instructions.

Class schedule links to `/calendar-helper?guide=schedule`, a dedicated Brightspace schedule guide that returns to `/settings/sources#class-schedule`. Calendar feed links to `/calendar-helper`, where provider instructions are centralized. Existing feed review, sign-in handoff and private-link handling remain in place. The forms keep provider selection, coursework detection and the iCloud public-calendar privacy explanation.

The GitHub product integration is removed from Sources, onboarding, task empty states and the downloadable Pip extension. New connections are rejected before a token is processed. Owner-checked tests return 410 for retired sources. Sync does not decrypt or fetch those sources, and they do not count toward active connection limits or Pip/calendar availability warnings. GitHub repository/CI tooling is unchanged.

Apply `supabase/migrations/20261025015300_retire_github_sources.sql` in the Supabase SQL editor after deploying that application removal. In one transaction it deletes every GitHub source (including its encrypted token and cascading item overrides), deletes any legacy task rows with `source = 'github'`, and invalidates only affected owners' cached pressure readings. Their next sync recomputes those readings. It preserves accounts, Google credentials, calendar feeds, other tasks and unaffected readings. No new environment variables are needed. The cleanup is permanent; a rerun is safe and preserves readings recomputed after the first run.

Database check constraints reject GitHub source/task inserts and updates even from service-role clients. Legacy enum values remain for compatibility with old clients; they cannot be used to persist new GitHub data. Application-side handling of disconnected historical rows remains a safe fallback for databases that have not yet applied the migration.

Forecast details use a 44-pixel icon-only close button at the upper-right corner, with the accessible name **Close**, keyboard focus and Escape behavior retained. The points footer is removed; the selected-day pressure breakdown remains.

Verification covers the migration against a seeded pre-retirement PostgreSQL schema, deletion/cascade across owners, preservation of other data, reruns and rejected authenticated/service-role writes. Existing API and browser checks cover rejected retired-source creation/tests, absence of retired-source fetches/decryption, retained drafts, keyboard tab navigation, connection failure and retry, historical source removal and the dedicated schedule guide. Public helper and forecast browser checks run across desktop, tablet and narrow layouts. These browser checks use fictional data and do not delete or reconnect real account sources.

The page is labelled **Connect** in navigation and keeps its existing `/settings/sources` URL. Focus with Pip, course materials and extension setup are available here; task creation and the pressure gauge stay in My Boiler.
