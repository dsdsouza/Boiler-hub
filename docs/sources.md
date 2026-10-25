# Source connections

Sources has two connection tabs: **Class schedule** and **Calendar feed**. Both preserve form drafts when switching tabs. Each shows **How to find your school calendar link** in place of the former description and inline instructions.

Class schedule links to `/calendar-helper?guide=schedule`, a dedicated Brightspace schedule guide that returns to `/settings/sources#class-schedule`. Calendar feed links to `/calendar-helper`, where provider instructions are centralized. Existing feed review, sign-in handoff and private-link handling remain in place. The forms keep provider selection, coursework detection and the iCloud public-calendar privacy explanation.

The GitHub product integration is removed from Sources, onboarding, task empty states and the downloadable Pip extension. New connections are rejected before a token is processed. Owner-checked tests return 410 for retired sources. Sync does not decrypt or fetch those sources, and they do not count toward active connection limits or Pip/calendar availability warnings. Existing records remain clearly disconnected and removable by their owner. No records or tokens are automatically purged; no migration or new environment variables are required. GitHub repository/CI tooling is unchanged.

Forecast details use a 44-pixel icon-only close button at the upper-right corner, with the accessible name **Close**, keyboard focus and Escape behavior retained. The points footer is removed; the selected-day pressure breakdown remains.

Verification covers rejected retired-source creation/tests, absence of retired-source fetches/decryption, retained drafts, keyboard tab navigation, connection failure and retry, historical source removal and the dedicated schedule guide. Public helper and forecast browser checks run across desktop, tablet and narrow layouts. These browser checks use fictional data and do not delete or reconnect real account sources.
