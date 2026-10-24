# Calendar Finder

The desktop Chrome/Edge helper finds subscription links on a school page the user opens. It does not scrape a password, call school APIs, enable feeds, or invent classes. Existing feed imports still work without installing it.

## Use it

1. Open **Onboarding → Find your calendar link**, the first setup step in Boilerplate. Choose **Download Calendar Finder** and unzip it, then expand **Set up Calendar Finder** for installation instructions. Choose **Find a link manually** to use the school guides without installing anything.
2. Open `chrome://extensions` or `edge://extensions`, turn on Developer mode, select **Load unpacked**, then choose the extracted `boiler-calendar-helper` folder.
3. Sign in to the school in that browser and open its Calendar. Open Subscribe, Calendar Feed or Export calendar. Click Calendar Finder in the browser’s extensions menu.
4. Choose **Review in Boilerplate**, review the URL/name/coursework setting, and connect it. A signed-out user signs into Boilerplate first; the tab retains the link for up to ten minutes. A copy-link fallback is available.

The packaged helper points to `https://boilerhub.work/calendar-helper`. That application route must be deployed before using its review action. During local development, use Copy link and paste into local Sources. Publishing this unpacked build to a browser store is a separate release step.

## Implementation

`browser-helper/` is a Manifest V3 extension using only `activeTab` and `scripting`. It has no background worker, broad host permission, cookies, storage, telemetry, remote script, or network fetch. Scanning begins on opening the popup or pressing Scan this page. This follows Chrome’s [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) model.

The self-contained scanner reads rendered anchors, non-password/non-hidden inputs, text areas, clipboard-link attributes, alternate `text/calendar` links and open shadow roots. It deduplicates subscription-shaped HTTPS/webcal links. It attempts accessible frames and falls back to the main frame if access fails. Cross-origin frames, closed shadow roots and browser-internal pages may be inaccessible. There is no interception of school traffic, cookies or tokens from hidden fields/scripts.

Known Brightspace, Canvas, Moodle and Blackboard feed paths are recognized. Other `.ics` and explicit webcal links are supported. If no subscription is present, the popup gives provider-specific instructions and offers school-calendar navigation links already present on the page. It never constructs a secret feed URL or clicks a school setting on the user’s behalf. Scanner limits are 20 results, 20,000 nodes and 300,000 text characters, with a large-page notice.

Choosing Review opens a fixed Boilerplate URL with the selected feed in a fragment, which is not part of the HTTP request. The public receiver strips the fragment, holds a short-lived draft in tab-scoped sessionStorage, and reuses the existing sign-in and source form. Only explicit form submission calls `/api/sources`; that endpoint still performs authentication, ownership, encryption, DNS/redirect checks and feed validation. Invalid inputs are rejected again at handoff. Success or Discard clears the draft. The helper never receives Boilerplate credentials.

## Packaging and checks

Run `pnpm helper:package` after changing extension files. This writes a deterministic ZIP to `public/downloads/boiler-calendar-helper.zip`. Unit checks enforce the exact source bytes in the download, minimal manifest permissions, safe URL handling, fragment transport, and draft expiry/cleanup. Browser regression coverage is in `tests/e2e/calendar-helper.spec.ts`.

Computer-use checks exercised the shipped scanner and popup controller against rendered fictional school pages. The browser fixture supplied the Chrome extension API wrapper; the scanner itself ran against the real DOM. Verified: four LMS formats, closed/open feed dialogs, deduplication, open shadow roots, skipped password/hidden/script data, main-frame fallback, restricted-page recovery, school-calendar navigation, review handoff, retained sign-in draft, retry, busy controls, successful import and cleanup, same-page handoff navigation, and discard focus recovery. The import responses were local fixtures; no school account or live source was changed.

Native unpacked-extension installation and school-specific live accounts have not been verified in this pass. Browser API permissions and platform differences remain distinct from the verified DOM and UI paths. The setup/error screen was also inspected at 320px with no horizontal overflow and no axe violations or incomplete rules. The design detector reported no findings. No universal school compatibility claim is made.
