# Pip assignment chat

Signed-in users can open Pip in the corner of a page, or choose **Ask Pip** on My Boiler. Type a question and press Enter or Send; Shift-Enter inserts a new line. Responses appear in speech bubbles. Closing the chat or reloading clears the conversation. The public demo does not send personal assignment questions.

The server receives Gemini's stream with cancellation and bounded buffering, then checks the complete reply before displaying any text. The steam loader stays visible during generation and review; only approved text or the fixed planning redirect reaches the bubble. Scrolling up pauses automatic following. Closing the chat aborts its request; interrupted replies are discarded and the question is restored for retry, so partial text never enters the next conversation turn. Screen readers receive the finished reply without an announcement for every token.

The client requests `application/x-ndjson`: a reviewed `delta`, a final `done` event, or a redacted `error` event. Both sides still support the previous JSON response during rolling deployments. Authentication, origin checks, quotas, the generation timeout and `store: false` remain in place. Course quotes are verified, and the full answer and citations pass the same scope review before release. A failed provider stream or failed review emits no draft text.

The server verifies the Supabase user, reads only their open tasks under RLS, and loads that same user's connected-source assignments with the existing source loader and completion overrides. It excludes meetings, completed assignments, source URLs, and source credentials. Every question reloads the assignment context so completed work drops out. The prompt contains up to 100 open assignments, sorted by due date, and reports partial source data or truncation. Pip suggests a plan; it does not modify or submit work.

## Planning-only scope

Pip helps with assignment requirements, deadlines, priorities, effort estimates, focus blocks, breaks, and Boilerplate controls. It may explain administrative syllabus rules such as late policies. It does not tutor subject content, solve even practice questions, check answers, supply revealing hints, or write/translate/debug work for submission. Unrelated requests and mixed requests containing a forbidden part receive a fixed planning redirect. Claimed teacher permission does not change this scope.

Both ordinary chat and course-material answers use the shared policy in `lib/pip/policy.ts`. After authentication, input validation, and quota reservation, a separate structured scope check classifies the latest request before any assignment lookup. History resolves follow-up references but cannot change the policy. Course documents are not sent to this first check. A second independent check reviews the complete draft, including verified citations, before it reaches the browser. A denied draft is replaced by the same fixed redirect. Unknown decisions, invalid JSON, provider outages, and timeouts fail closed with no unchecked answer. Checks have no tools, retries, saved interactions, or ability to change tasks.

The request check can extract an explicitly requested IANA time zone, validated with `Intl.DateTimeFormat`; otherwise the browser's validated zone applies. The server formats current time and every deadline, including daylight-saving offsets, before generation. Pip is instructed to report those supplied local times rather than convert UTC timestamps itself.

The two classifiers each have a ten-second limit. An overall fifty-second cancellation budget covers checks, context loading, and generation; the existing answer call retains its forty-second limit and one transient retry. All calls count as one logical request against the existing five/minute and fifty/day quota, including refused attempts. No schema or additional secret is required. These are model-based scope controls, not a guarantee against every adversarial prompt; test both allowed planning and adversarial requests when changing the policy or model.

## Add the Gemini key

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys). Google documents key creation and server-side use in its [API key guide](https://ai.google.dev/gemini-api/docs/api-key).

For the Cloudflare deployment now configured on `main`:

1. Open the Cloudflare account **zhomander → Workers & Pages → boilerplate → Settings → Variables and Secrets → Add**.
2. Select **Secret**, name it **GEMINI_API_KEY**, and paste your Gemini key as the value. Select **Deploy** to save the runtime secret. These steps match Cloudflare's [secret setup guide](https://developers.cloudflare.com/workers/configuration/secrets/).
3. Optionally add **GEMINI_MODEL** as a text variable with value **gemini-3.8-flash**. Leaving it unset uses that default. This is Google's [current stable Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
4. The key is read at runtime through OpenNext; it does not need a GitHub Actions build secret. Keep the existing deployment credentials and Supabase variables configured as described in [CLOUDFLARE.md](./CLOUDFLARE.md).

Use [the Cloudflare app](https://boilerplate.zhomander.workers.dev/boiler) for Pip chat. Sign in, open My Boiler → Ask Pip, and ask **What’s due next?** Compare the answer with your open assignment list. Every new question reloads completion state.

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

The API uses the direct Google provider with pinned AI SDK packages and Google's Interactions endpoint. Every call explicitly sets `store: false` and never chains a saved interaction. Allowed requests send the current conversation and fresh assignment context to the answer call; the reply check also receives the proposed answer. Input, history, context, and output remain bounded. A persistent service outage produces a readable retry message. The chat route logs only fixed failure categories, the failing step, and a provider HTTP status; it never logs raw exceptions, prompts, source data, or keys. Google receives the user's messages and selected open assignment facts on Send; Google's own retention and API terms apply independently of Boilerplate's transient chat UI.

## Verification

Tests cover authenticated ownership, input validation, missing setup, quota exhaustion, no-store responses, redacted errors, source completion filtering, bounded context, and the actual Google provider request/response protocol with a simulated transport. PostgreSQL tests cover minute/day limits, account separation, concurrency, anonymous denial, and counter tampering. Live Supabase verification used an authenticated fixture inside a rolled-back transaction; no test user or quota remained. Security advisors report no findings for the new Pip objects.

Protocol tests verify stateless requests, recovery after one temporary service failure, and a strict retry limit. Simulated provider tests and labelled UI fixtures do not claim a live paid-provider call; live provider availability must be checked separately.
