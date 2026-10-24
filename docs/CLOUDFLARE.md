# Cloudflare deployment

Boilerplate runs as the `boilerplate` Worker in the `zhomander` Cloudflare
account (`831d31b4049fece76716fe9529e28a4c`). Its default URL is
<https://boilerplate.zhomander.workers.dev>.

The `Deploy Boilerplate to Cloudflare` GitHub Actions workflow builds and deploys
every push to `main`. It can also be started manually from the Actions tab.
It uses the OpenNext Cloudflare adapter for the Next.js app and its server routes.

## Deployment credential

The repository secret `CLOUDFLARE_API_TOKEN` must contain a Cloudflare token with
Workers Editor access scoped to the `boilerplate` Worker in the `zhomander`
account. Do not store credentials in the repository.

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

Runtime variables and secrets stay in Cloudflare across deployments;
`keep_vars` is enabled in `wrangler.jsonc`. Application secrets are not passed
into the build. After changing the two public build variables, rerun the workflow
to rebuild the browser bundle.

## URLs and scheduled sync

Configure the custom domain, DNS, Supabase redirect URLs, and Google OAuth origins
as part of the URL migration. This setup does not change those settings or the
existing Vercel project.

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
