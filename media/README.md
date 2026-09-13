# FOGFALL media pack

Cover art, promotional illustration, reusable brand assets, and actual gameplay captures. These files support the repository showcase; the game build and offline cache do not include this directory.

## Artwork

| Asset | Format | Use |
| --- | --- | --- |
| [Cover](art/fogfall-cover.png) | 1672×941 PNG | Wide hero, repository cover, press feature |
| [Square promo](art/fogfall-promo.png) | 1254×1254 PNG | Social post, announcement, square feature |

Both illustrations use the same courier, fog-covered San Francisco, broken cyan signal ring, gold pulse light, and white/cyan FOGFALL title. Keep their generous margins and complete title when placing them. They are key art rather than representations of the game's graphics.

Created with the built-in image-generation tool. The [complete prompt set](art/prompts.md) records each request; the promo used the cover as its visual reference.

## Brand assets

[![FOGFALL brand sheet](brand/brand-sheet.svg)](brand/brand-sheet.svg)

- **Wordmarks:** [color SVG](brand/wordmark.svg), [white SVG](brand/wordmark-white.svg). Transparent background and outlined Oxanium lettering; no font loading required.
- **Signal emblem:** [transparent SVG](brand/signal-mark.svg), [transparent 512px PNG](brand/signal-mark.png).
- **Avatar:** [SVG](brand/signal-avatar.svg), [512px PNG](brand/signal-avatar.png).
- **Brand sheet:** [SVG](brand/brand-sheet.svg), [1200×640 PNG](brand/brand-sheet.png).
- **Feature icons:** [route](brand/route.svg), [threat](brand/threat.svg), [pulse](brand/pulse.svg), [landmark](brand/landmark.svg), [build](brand/build.svg), [offline](brand/offline.svg).
- **Kit icons:** [Courier](brand/courier.svg), [Relay](brand/relay.svg), [Breaker](brand/breaker.svg).

The emblem follows the game's existing launcher mark: an interrupted cyan ring with a diagonal gold pulse. Feature icons use the same squared strokes and shape vocabulary as the map. Leave at least one ring-stroke width around icons and half the wordmark's letter height around the wordmark. Preserve proportions; use the white wordmark when color contrast is limited. Color assets are intended for dark backgrounds.

| Token | Hex | Role |
| --- | --- | --- |
| Fog | `#000000` | Background |
| Ice | `#80E8FF` | Signal structure and navigation |
| Signal | `#FFD278` | Player, pulse, and objectives |
| Hostile | `#FF827D` | Threats and warnings |
| Repair | `#A1F3CE` | Hull and recovery |
| Type | `#EFFCFF` | Primary lettering |

Use **Oxanium Semibold** for headings and **Atkinson Hyperlegible** for reading. The brand sheet's lettering is also outlined. Font notices: [Oxanium](brand/OFL-Oxanium.txt), [Atkinson Hyperlegible](brand/OFL-Atkinson.txt).

## Gameplay screenshots

All six are unmodified 600×600 browser captures of the production UI. Saved scenes are reached through the seeded simulation, including a real landmark detour and the completed expedition that earns both kit unlocks. They are not photographs through the glasses.

| Screenshot | Feature |
| --- | --- |
| [Tactical combat](screenshots/tactical-combat.png) | Conductor warning tiles at Moscone |
| [Landmark deal](screenshots/landmark-deal.png) | Optional Ferry Building tradeoff |
| [District upgrade](screenshots/district-upgrade.png) | Three choices after an uplink |
| [Starting kits](screenshots/starting-kits.png) | Courier, Relay, and Breaker unlocked |
| [Build overview](screenshots/build-synergies.png) | Stacked pulse damage and kill recovery |
| [Offline readiness](screenshots/offline-ready.png) | Cached files and local saves while disconnected |

To refresh the captures, run `npm run build`, start `npm run dev` in another terminal, then run `node scripts/capture-media.mjs`. The script uses Playwright and the existing expedition fixture, checks that the run wins, waits for local fonts and offline readiness, and writes [capture metadata](screenshots/captures.json). It does not alter the simulation or UI. An optional `FOGFALL_CAPTURE_URL` selects another deployment of the same build.
