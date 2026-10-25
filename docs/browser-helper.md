# Calendar import helpers

The Pip toolbar and the separate Calendar Finder find subscription links on a school page the user opens. They do not scrape a password, call school APIs, enable feeds, or invent classes. Calendar feeds support calendar events and coursework deadlines, not grades or course files. Existing feed imports still work without either extension.

## Pip toolbar (Focus with Pip v0.3.3)

1. Install or update the focus extension using the [Focus with Pip instructions](./accountability.md#demo-knowing-what-is-due-versus-actually-starting). Reload the extension and Boilerplate after replacing an existing unpacked build.
2. Sign in to the school in that browser and open its calendar. Open the Pip toolbar popup, headed **Import your coursework?**, and choose Brightspace, Canvas, Moodle, Blackboard, or **Another calendar**. Its top row also shows the study-block status and an **Open Pip** link.
3. Follow the provider steps below and leave the feed dialog or subscription link visible. Choose **Find calendar links on this page**. Opening the popup or changing the provider does not scan; only the Find button starts a scan of the chosen page. If that page cannot be scanned, open the school calendar in a regular tab and try again.
4. For setup, choose **Use in onboarding** beside a found link. It opens the trusted Boilerplate origin at `/onboarding#feed=…`; review the URL, name and coursework setting in the calendar step, then explicitly connect it. For an independent import, choose **Review import in Boilerplate** to use `/calendar-helper` instead. The popup's Sources link also offers Google Calendar and Apple Calendar connections.

Onboarding uses one Pip extension for every goal and requires version 0.3.2 or later. Its browser nonce/version check is installation feedback, not tamper-proof attestation. Students cannot skip coursework setup: at least one ICS source must have **Coursework** enabled, and every connected coursework ICS source must be healthy with a successful sync timestamp. Google Calendar alone does not satisfy this gate. Students then explicitly review the imported deadlines; a readable feed with no current deadlines has a separate empty-result confirmation. A fresh server check and an encrypted, owner-bound, two-hour review receipt tie completion to the reviewed import. Changed, removed or failing feeds require a new check and review. The receipt and setup metadata contain no feed URLs or event contents. Professionals can continue without adding coursework. See [guided onboarding](./onboarding.md) for the exact checks and saved-progress behavior.

| School calendar | Make the subscription link visible before Find |
| --- | --- |
| Brightspace | Calendar → Settings → enable Calendar Feeds; then Subscribe → All Calendars and Tasks. |
| Canvas | Calendar → Calendar Feed in the sidebar. |
| Moodle | Calendar → Export calendar; choose courses and a time range covering the term, then Get calendar URL. |
| Blackboard | Calendar → settings → Share calendar (Ultra) or Get External Calendar Link (Original). |
| Another calendar | Look for Subscribe, Calendar Feed, Export calendar, or iCalendar. The school may need to enable feeds. |

The Pip popup uses the existing iron-and-brass colors, Bebas Neue headings, Inter text, and Pip icon inherited from `focus-extension/focus.css` and its local assets. It adds no new global design system.

## Separate Calendar Finder

Calendar Finder remains available with its existing workflow:

1. Outside onboarding, download `/downloads/boiler-calendar-helper.zip` from the deployed Boilerplate site and unzip it to get the `boiler-calendar-helper` folder. The `/calendar-helper` route also provides the independent review and manual-link workflow. Onboarding uses Pip instead of requiring this separate extension.
2. Open `chrome://extensions` or `edge://extensions`, turn on Developer mode, select **Load unpacked**, then choose the extracted `boiler-calendar-helper` folder.
3. Sign in to the school in that browser and open its Calendar. Open Subscribe, Calendar Feed or Export calendar. Click Calendar Finder in the browser’s extensions menu.
4. Choose **Review in Boilerplate**, review the URL/name/coursework setting, and connect it. A signed-out user signs into Boilerplate first; the tab retains the link for up to ten minutes. A copy-link fallback is available.

The separate Calendar Finder points to `https://boilerhub.work/calendar-helper`. That application route must be deployed before using its review action. During local development, use its Copy link action and paste into local Sources. Pip instead uses the trusted Boilerplate origin saved when the extension pairs, with `https://boilerplate.zhomander.workers.dev` as its fallback. Publishing either unpacked build to a browser store is a separate release step.

## Implementation

The separate `browser-helper/` Calendar Finder is a Manifest V3 extension using only `activeTab` and `scripting`. It has no background worker, broad host permission, cookies, storage, telemetry, remote script, or network fetch. Its existing scan begins on opening its popup or pressing **Scan this page**. Pip v0.3.3 reuses its scanner and protocol, with scanning gated by the explicit **Find calendar links on this page** click. Pip retains its focus/reminder permissions and adds `activeTab` and `scripting` for temporary chosen-page access; it requests no persistent school host access. Both follow Chrome’s [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) model.

The self-contained scanner reads rendered anchors, non-password/non-hidden inputs, text areas, clipboard-link attributes, alternate `text/calendar` links and open shadow roots. It deduplicates subscription-shaped HTTPS/webcal links. It attempts accessible frames and falls back to the main frame if access fails. Cross-origin frames, closed shadow roots and browser-internal pages may be inaccessible. There is no interception of school traffic, cookies or tokens from hidden fields/scripts.

Known Brightspace, Canvas, Moodle and Blackboard feed paths are recognized. Other `.ics` and explicit webcal links are supported. If no subscription is present, the popup gives provider-specific instructions and offers school-calendar navigation links already present on the page. It never constructs a secret feed URL or clicks a school setting on the user’s behalf. Scanner limits are 20 results, 20,000 nodes and 300,000 text characters, with a large-page notice.

Choosing Review opens the trusted Boilerplate `/calendar-helper` route; Pip’s **Use in onboarding** instead opens `/onboarding`. Both carry the selected feed in a fragment, which is not part of the HTTP request. Pip validates the saved app origin against the existing app allowlist before building either destination; page content cannot choose the review host. The receiver strips the fragment, holds a ten-minute draft in tab-scoped sessionStorage, and reuses the existing sign-in and source form. Only explicit form submission calls `/api/sources`; that endpoint still performs authentication, ownership, encryption, DNS/redirect checks and feed validation. Invalid inputs are rejected again at handoff. A successful onboarding import clears the handoff draft; the independent receiver clears it on success or Discard. Neither helper receives Boilerplate credentials.

## Packaging and checks

Run `pnpm helper:package` after changing the separate Calendar Finder files. This writes a deterministic ZIP to `public/downloads/boiler-calendar-helper.zip`. Run `pnpm pip:package` for Focus with Pip v0.3.3; it reproducibly writes `public/downloads/boilerplate-focus-extension.zip` using `scripts/package-focus-extension.mjs`. Pip packaging copies the canonical `browser-helper/scan.js` and `browser-helper/protocol.js` into `focus-extension/imports/` for unpacked loading and reads those canonical files into the ZIP. Its explicit archive list includes popup/import modules, existing focus/reminder assets and local fonts, and excludes tests.

Unit checks enforce the separate helper's exact download bytes, minimal manifest permissions, safe URL handling, fragment transport, and draft expiry/cleanup. `focus-extension/imports.test.ts` covers Pip archive/source equality, trusted review destinations, school navigation boundaries, and the exact permission set. Browser regression coverage for the shared receiver is in `tests/e2e/calendar-helper.spec.ts`.

Computer-use checks exercised the shipped scanner and popup controller against rendered fictional school pages. The browser fixture supplied the Chrome extension API wrapper; the scanner itself ran against the real DOM. Verified: four LMS formats, closed/open feed dialogs, deduplication, open shadow roots, skipped password/hidden/script data, main-frame fallback, restricted-page recovery, school-calendar navigation, review handoff, retained sign-in draft, retry, busy controls, successful import and cleanup, same-page handoff navigation, and discard focus recovery. The import responses were local fixtures; no school account or live source was changed.

A native Brave check on October 24, 2026 verified the updated Pip v0.3.3 installation, its live onboarding handshake, an existing Brightspace All Calendars and Tasks subscription, the explicit Find scan and Use in onboarding handoff, and a real coursework import through the deployed app. Four imported title/course/due-time samples matched the school calendar; the unchecked review gate and server-validated completion worked. Finish later saved and resumed the unfinished calendar step. No school assignments were changed or additional school feed access enabled. The test also exposed a Workers DNS CNAME compatibility issue, fixed while retaining checks on every resolved IP address and rejecting alias-only answers. Browser API permissions and platform differences remain distinct from these verified paths. The setup/error screen was also inspected at 320px with no horizontal overflow and no axe violations or incomplete rules. The design detector reported no findings. No universal school compatibility claim is made.
