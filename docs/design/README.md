# Boilerplate design reference

Source: Claude design artifact "Boilerplate" (https://claude.ai/artifact/5zkYF3ADGgZi3sDPv2RgVD).
These .dc.html files are design templates, not runnable pages: `{{name}}` placeholders are
values the design tool fills in (score, zone, sizes, animation timings). Read them for layout,
copy, SVG geometry and colors; rebuild them as React components. Open the artifact link to see them rendered.

| File | Screen |
| --- | --- |
| Main.dc.html | Landing (hero boiler with "drag to add pressure" slider, how-it-works, CTA) |
| MyBoiler.dc.html | My Boiler, desktop |
| Phone.dc.html | My Boiler, 390px phone |
| EngineRoom.dc.html | Engine Room, teacher view |
| Boiler.dc.html | Boiler component (SVG body, sight glass, steam puffs via SMIL animate) |

## Fonts
- Display: Bebas Neue
- Body: Inter
- Numbers, gauges, labels: JetBrains Mono (500, 700)

## Palette (dark theme, as designed)
| Token | Hex | Use |
| --- | --- | --- |
| bg | #15120E | page background (soot) |
| surface | #1F1A14 | cards, plates |
| surface-2 | #2A231B | raised panels |
| line | #3A3027 | borders, rules |
| rivet | #6B5A44 | rivets, quiet strokes |
| muted | #B3A48C | secondary text |
| text-2 | #D9CCB5 | body text |
| text | #F1E7D3 | primary text (parchment) |
| steam | #ECE6DA | steam puffs |
| brass | #D1A85A | brass, primary accent, slider |
| brass-light | #E3BE74 | links, highlights |
| cool | #7FB3D5 | Cool zone / water |
| hot | #F0913A | Hot zone |
| redline | #F25C45 | Redline zone |

Riveted plates: `.plate` uses four radial-gradient dots in the corners (see Main.dc.html).
A light theme is not designed yet; derive it (parchment bg, iron text) with the same accents.
