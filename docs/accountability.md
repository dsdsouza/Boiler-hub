# Focus with Pip

This implements the mentor's accountability demo **inside Boilerplate**. My Boiler keeps its existing iron-and-brass design, pressure gauge, live calendar, tasks, Pip chat, and shared controls. The new Focus with Pip panel also appears with synthetic tasks in the public demo. No extra app, backend service, schema migration, or hosting project is needed.

## Run and configure

Use the existing `pnpm dev` workflow and open `/boiler`, or `/demo` for the public fixture. The existing server environment fields are used:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Put the actual key in the ignored `.env.local` (or the app host's runtime secrets), then restart the local app. Never use a `NEXT_PUBLIC_` API key. Follow [Pip chat setup](./pip-chat.md) for the existing authentication and hosting configuration. Live Gemini replies need the configured key and sign-in. Both ordinary chat and course questions use Gemini Interactions with `store: false`. Missing keys and provider failures remain visible errors, with no pretend AI fallback.

## Demo: knowing what is due versus actually starting

1. Open My Boiler → **Chat with Pip**. Ask what is due next, what to prioritize, or when to study. Pip uses fresh open assignments and live calendar availability. Ask for a study block or accountability reminders: Pip prepares a concrete proposal for an open assignment, with a small goal and a 10–45 minute duration. Nothing starts until you accept its card. Missing or incomplete calendars require your explicit confirmation that the proposed time works. The existing **Plan with Pip** control also drafts a question in this visible chat.
2. In **Course material for Pip**, paste a syllabus/assignment excerpt or upload `.txt`/`.md`. Send a question from Ask Pip. Answers about course text include exact quotes checked against the supplied documents. Documents stay in the shared conversation memory across navigation and closing the chat, clear on reload or sign-out, and are sent to Google with the chat request. Three documents, 6,000 characters each and 12,000 combined are supported. A PDF can be copied and pasted as text.
3. Install the focus extension: download it from the panel, unzip, visit Chrome's Extensions page, turn on Developer mode, choose **Load unpacked**, select the folder, and reload Boilerplate. Use extension **v0.2.0** and look for **Pip extension paired**. Choose **Enable laptop reminders** and check the test notification; allow Chrome notifications in the laptop’s settings. An existing installation needs its unpacked files replaced, its extension reloaded, and Boilerplate reloaded. Accepting Pip’s plan then hands its task, goal and times to the extension. The unpacked source also lives in `focus-extension/`.
4. Open YouTube or Reddit in another tab. Choose **10-second demo**, then return to that tab. In ten seconds Pip interrupts it with a real focus page. This is an explicitly opted-in, one-minute demonstration; it uses the same blocking path as regular sessions.
5. Pip sends a heads-up, a start reminder, a mid-block check-in, and a completion check-in (with one follow-up five minutes later). Clicking a notification opens Pip. These reminders and website blocking work with the Boilerplate tab closed; Chrome must keep running. Return to Pip, ask for help taking the first step, and work on the assignment. When the whole assignment is finished, confirm that fact and choose **Mark done & release**. This uses the existing task completion API and vent animation. Completing only a small substep does not require marking the assignment done: use **End focus** instead.

**Use my next free window** finds the first opening in the events already loaded into My Boiler, at least one minute ahead. Overlapping events are merged by advancing the proposed start past each conflict. It does not create a calendar event, and missing calendars can hide conflicts. The student explicitly opts in when scheduling; the installed extension starts blocking at that time without another click.

## Blocker boundaries

The Manifest V3 extension pauses YouTube, Instagram, TikTok, Reddit, and X. It redirects new navigations and already-open distracting tabs. School sources and Boilerplate remain accessible. It does not inspect/send browsing history to Gemini, block OS apps, control a phone, or enforce on another device. Site access is scoped to the five blocked domains; the app bridge accepts `boilerhub.work`, `boilerplate.zhomander.workers.dev`, and documented local development ports.

Focus is local to the browser. Chrome stores the chosen task title, small goal, and session times so its alarms work when the app page closes. The extension releases rules at the deadline and runs a 30-second watchdog. Browser/OS scheduling or sleep can delay alarms; after waking, the next event clears expired rules. Reopening My Boiler restores a session only if its task is in the current person's loaded assignment list. Uploads are not stored by the extension.

The assistant and extension both offer **emergency release**. A cancelled session cannot be reactivated by a stale page. Disabling or removing the extension also immediately releases its rules. Reopen the original website afterward. The timer works without the extension while the page remains open, and the app explicitly reports that blocking is not confirmed. Laptop notifications require extension v0.2.0, explicit opt-in, and notification permission for Chrome. The app tab may be closed, but Chrome must remain running. Turning reminders off clears outstanding Pip notifications; ending a session stops its later reminders.

Time expiring releases blocking and asks what got done; it does not mark work complete. Completion is the student's explicit self-report, saved using the existing authenticated task API. No completion is credited when that API fails. Calendar and source integrations that already work are preserved. Gradebook and device-wide enforcement remain future work, without claims of live functionality.

## Verification

`pnpm typecheck`, `pnpm lint`, and `pnpm test` cover the integration. Added tests exercise proactive boundaries, overlap scheduling, request limits, source quote verification, the Gemini request protocol through a synthetic transport, actual-domain matching and cancellation. A synthetic provider test is not evidence of a live Gemini-generated answer.

The extension ZIP is a static copy of `focus-extension/{manifest.json,background.js,bridge.js,rules.mjs,reminders.mjs,notifications.js,icon128.png,focus.html,focus.js,focus.css}` plus `focus-extension/fonts/`, reusing Boilerplate's existing local font assets. Repackage those files after editing them; exclude test files. Existing Calendar Finder is a separate extension and is unchanged.
