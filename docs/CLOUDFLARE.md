# Cloudflare deployment

Boilerplate runs as the `boilerplate` Worker in the `zhomander` Cloudflare
account (`831d31b4049fece76716fe9529e28a4c`). Its default URL is
<https://boilerplate.zhomander.workers.dev>. The public application is
<https://boilerplate.select>.

The `Deploy Boilerplate to Cloudflare` GitHub Actions workflow builds and deploys
every push to `main`. It can also be started manually from the Actions tab.
It uses the OpenNext Cloudflare adapter for the Next.js app and its server routes.

Merged pull requests deploy after the checks, build, and upload succeed. This
normally takes a few minutes; a failed run leaves the last successful version
serving traffic. Open pull requests are not deployed to this production Worker.
Before uploading, the workflow checks that its commit still matches `main`, so
rerunning an older workflow cannot replace a newer commit. Each deployed Worker
version is tagged with its full Git commit SHA for comparison with `main`.

## Deployment credential

The repository secret `CLOUDFLARE_API_TOKEN` must contain a Cloudflare token with
Workers Editor access scoped to the `boilerplate` Worker and Workers Metadata
Read-Only access at the `zhomander` account scope. The read-only permission lets
Wrangler inspect dashboard configuration after variables or settings are changed
there; without it, the metadata check can fail before upload. Write access stays
limited to `boilerplate`. Do not store credentials in the repository.

## Application environment variables

Add these **GitHub Actions repository secrets** so Next.js can inline them when
building browser code:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

In Cloudflare, open **Workers & Pages → boilerplate → Settings → Variables and
Secrets**, and add the variables from `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (secret)
- `TOKEN_ENCRYPTION_KEY` (secret; preserve the existing value so saved tokens
  remain decryptable)
- `CRON_SECRET` (secret)
- `GEMINI_API_KEY` (secret; enables Pip assignment chat)
- `GEMINI_MODEL` (optional text variable; defaults to `gemini-3.8-flash`)

See [Pip chat setup](./pip-chat.md) for the exact Gemini key steps. Pip uses the
key at runtime; do not add it to the public build variables or Supabase secrets.

Runtime variables and secrets stay in Cloudflare across deployments;
`keep_vars` is enabled in `wrangler.jsonc`. Application secrets are not passed
into the build. After changing the two public build variables, rerun the workflow
to rebuild the browser bundle.

## URLs and scheduled sync

The public app uses `https://boilerplate.select`; the Worker URL remains available
at `https://boilerplate.zhomander.workers.dev`. Supabase's Site URL and redirect
allowlist, and Google's authorized origins, must include the public origin and
its `/auth/callback` as appropriate. Google's authorized redirect URI remains the
Supabase project's `/auth/v1/callback` URL.

Cloudflare runs the existing `/api/cron/resync` handler daily at **10:00 UTC**.
The custom Worker supplies the existing bearer secret without making a public
HTTP request. It skips the job until `CRON_SECRET` is configured.

## Retired Vercel deployment

Cloudflare is the sole deployment target. `vercel.json` contains only
`git.deploymentEnabled: false`, following [Vercel's documented opt-out](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).
Keep this small guard while the old projects remain connected: deleting the file
would restore automatic Vercel deployments. The Vercel cron declaration and
Vercel-specific framework deployment ID are removed. No Vercel preview is a
release requirement.

The owner of the old `boilerplate` and `boiler-hub` projects should disconnect
`dsdsouza/Boiler-hub` in each project's **Settings → Git**, and disable any existing
Vercel cron jobs in **Settings → Cron Jobs**. The repository opt-out stops new Git
deployments; it does not delete existing deployments or their stored settings.
These project settings require access to the owning Vercel account. Do not delete
unrelated projects, credentials, or domain records.

The remaining release checks are the complete **Boilerplate QA** gate (types,
lint, unit/database contracts, all browser shards, workflow/UI reports, and the
Cloudflare build, dry run and local Workers runtime cases), followed by the
**Deploy Boilerplate to Cloudflare** workflow on `main`. Confirm its upload step
actually ran and the deployed Worker version carries the released Git SHA;
a successful stale run that skipped upload is not deployment evidence.

## Local checks and manual deployment

```sh
pnpm install --frozen-lockfile
pnpm cf-typegen
pnpm build:cloudflare
pnpm exec wrangler deploy --dry-run
pnpm preview:cloudflare
```

After authenticating Wrangler against `zhomander`, deploy a completed build with
`pnpm deploy:cloudflare`.
