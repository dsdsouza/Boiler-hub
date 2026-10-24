# Cloudflare runtime

Boilerplate deploys the OpenNext Worker to the `zhomander` account as
`boilerplate`, at https://boilerplate.zhomander.workers.dev.

The account needs **Workers Paid**. Workers Free allows only 10 ms of CPU per
invocation, which caused real authenticated requests to terminate with
`exceededCpu` (HTTP 503 / Cloudflare 1102). `usage_model: standard` in API
metadata does not establish that the account has a paid subscription.

`wrangler.jsonc` explicitly sets the standard paid 30,000 ms CPU ceiling for
rendering, calendar parsing and background sync. A 1,000 ms trial budget left
little margin: live monitoring observed a successful request at 828 ms.
This is CPU execution time; waiting for Supabase or
Google does not consume that budget. The ceiling also bounds runaway work.
Cloudflare rejects this configuration on Free; upgrading the subscription is
an account-owner action and is not performed by the deploy workflow.

API handlers authenticate their own callers, so session-refresh middleware
does not run again on `/api` routes. Page protection and page-session refresh
remain enabled. Forecast time-zone formatters are reused within one
calculation; calendar contents and user identities are not cached globally.

Before releasing, run type checks, lint, unit/database tests, the OpenNext build
and Worker packaging check. Exercise the full browser suite against a local
OpenNext preview, then run public and authenticated suites against the live
Cloudflare deployment. Watch Worker error logs during the live account run
and confirm there are no `exceededCpu` outcomes. Local preview does not enforce
the production CPU limit, so a local pass alone cannot verify this fix.

References: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
