# Cloudflare deployment

Boilerplate runs as the `boilerplate` Worker in the `zhomander` Cloudflare
account (`831d31b4049fece76716fe9529e28a4c`). Its default URL is
<https://boilerplate.zhomander.workers.dev>.

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

The Cloudflare app uses `https://boilerplate.zhomander.workers.dev`. Supabase's
Site URL uses this origin, its redirect allowlist includes
`https://boilerplate.zhomander.workers.dev/auth/callback`, and the Google OAuth
client includes this origin. Google's authorized redirect URI remains the
Supabase project's `/auth/v1/callback` URL.

`boilerhub.work` remains on Vercel. Its existing Google origins and Supabase
callback URLs are retained; this setup does not change its DNS or custom domain.

Cloudflare runs the existing `/api/cron/resync` handler daily at **10:00 UTC**,
matching `vercel.json`. The custom Worker supplies the existing bearer secret
without making a public HTTP request. It skips the job until `CRON_SECRET` is
configured. Disable the old Vercel cron when cutting over to avoid duplicate jobs.

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
