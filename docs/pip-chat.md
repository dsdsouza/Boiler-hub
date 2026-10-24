# Pip assignment chat

Signed-in users can open Pip in the corner of a page, or choose **Ask Pip** on My Boiler. Type a question and press Enter or Send; Shift-Enter inserts a new line. Responses appear in speech bubbles. Closing the chat or reloading clears the conversation. The public demo does not send personal assignment questions.

The server verifies the Supabase user, reads only their open tasks under RLS, and loads that same user's connected-source assignments with the existing source loader and completion overrides. It excludes meetings, completed assignments, source URLs, and source credentials. Every question reloads the assignment context so completed work drops out. The prompt contains up to 100 open assignments, sorted by due date, and reports partial source data or truncation. Pip suggests a plan; it does not modify or submit work.

## Add the Gemini key

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys). Google documents key creation and server-side use in its [API key guide](https://ai.google.dev/gemini-api/docs/api-key).

For **boilerhub.work**:

1. Open the hosting project **boiler-hub**, which serves boilerhub.work. Open **Settings → Environment Variables**.
2. Add **GEMINI_API_KEY**. Paste the Gemini key as its value, select **Secret**, and select **Production** and **Preview**. Save. If the account requires different secret values per environment, add separate keys for those environments.
3. Optionally add **GEMINI_MODEL** as Config, value **gemini-3.8-flash**. Leaving it unset uses that default. This is Google's [current stable Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
4. Deploy this PR after all checks and preview deployments pass. Environment changes apply to new deployments. If changing the key after deployment, redeploy to load the new value. At implementation time the existing host deployment quota was exhausted; a new build must wait for that quota to reset.
5. Sign in, open My Boiler → Ask Pip, and ask **What's due next?** Compare the answer with your open assignment list. Complete an assignment in My Boiler and ask again in the same chat; the new request uses fresh completion state.

The Gemini key belongs in the **app server's environment**. Supabase already provides authentication, assignment data, and request budgets; this implementation does not run a Supabase Edge Function and does not require a Gemini secret in Supabase. Existing production Supabase, source-encryption, and Google Calendar environment variables continue to be used.

For local development, the ignored `.env.local` in the main checkout (`/Users/alexanderzhomir/Desktop/Boiler-hub/.env.local`) has these prepared fields:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

Paste the key after `GEMINI_API_KEY=` and restart the development server. A fresh local checkout also needs the app's existing Supabase and source-encryption values from `.env.example`; those private values are not copied out of hosting by this change. Worktrees can symlink the main checkout's `.env.local`. The key uses a server-only name, with no `NEXT_PUBLIC_` prefix.

## Supabase setup

The additive migration [20261024211627_pip_chat_quota.sql](../supabase/migrations/20261024211627_pip_chat_quota.sql) was created with the Supabase CLI and applied to the existing `dtnjfycvhbbhzfkfnfio` project on October 24, 2026. It has been verified there; no SQL setup remains for that project. For a new environment, apply the shipped migrations in order, including this one.

`pip_private.chat_usage` stores one counter row per account: UTC day, daily request count, minute-window start, and minute count. It stores no prompts, replies, or assignment contents. The authenticated `pip_chat_take_quota()` RPC uses the caller's JWT identity with no user-supplied id or clock. Its private implementation atomically admits at most five attempts per minute and fifty per UTC day. Anonymous callers cannot execute it, and authenticated callers cannot read or reset the counter table. This limit applies across server instances. Failed attempts after quota reservation also count; missing-key and invalid requests do not reserve quota.

The API uses the direct Google provider with pinned AI SDK packages, a 25-second generation timeout, bounded input/history/context/output, and no automatic provider retries. The chat route does not log provider errors, prompts, source data, or keys. Google receives the user's messages and selected open assignment facts on Send; Google's own retention and API terms apply independently of Boilerplate's transient chat UI.

## Verification

Tests cover authenticated ownership, input validation, missing setup, quota exhaustion, no-store responses, redacted errors, source completion filtering, bounded context, and the actual Google provider request/response protocol with a simulated transport. PostgreSQL tests cover minute/day limits, account separation, concurrency, anonymous denial, and counter tampering. Live Supabase verification used an authenticated fixture inside a rolled-back transaction; no test user or quota remained. Security advisors report no findings for the new Pip objects.

A real Gemini-generated reply still requires the API key. Simulated provider tests and labelled UI fixtures do not claim a live paid-provider call.
