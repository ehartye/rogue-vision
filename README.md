# FOGFALL · Rogue Vision

A short, turn-based sci-fi roguelike for Meta Ray-Ban Display and the Neural Band. Cross a signal-haunted San Francisco, modify your build, and shut down the corrupted Dreamforce keynote at Moscone.

**Play:** https://ehartye.github.io/rogue-vision/

## On the glasses

Add the public URL as a Web App in the Meta AI app (Developer Mode enabled). Open it on the glasses while online and wait for **Offline ready**. Start a run, disconnect, then reopen and resume to verify your device is ready for travel. First-time loading needs internet; later visits use the cached game. Device cache eviction or clearing app data requires another online visit.

Scan the [add-to-glasses QR code](assets/add-to-glasses.png) with your phone to open Meta's setup deep link. It was generated locally using Meta's official toolkit.

- **Swipe:** move one square; move into a hostile to attack.
- **Pinch:** open actions, then swipe to choose and pinch to confirm.
- **Back:** close the current screen with progress saved. Keep going back to reach the title; Back at the title is left to the native shell.
- **Pulse:** damages and disrupts nearby hostiles. Every third kill restores one charge.
- **Coral warning tiles:** a strike lands there next turn. Move away first.
- **Cyan uplink:** the lower-right exit. Install an upgrade between districts. Defeat the Conductor before the final extraction.
- **Gold ring:** an optional landmark deal. Inspect the cost, then accept or pass safely. Each district has its own street pattern; supplies reward exploration away from the exit route.
- **Your build:** open actions to inspect your starting kit and installed modifications without spending a turn. Aftershock strengthens melee attacks on disrupted enemies; Kinetic recovery recharges pulses through melee strikes. Upgrade effects stack.

Choose a starting kit before each new expedition. Courier is balanced and always available. Relay unlocks after 10 cumulative kills: less hull and blade damage, stronger pulses, and a charge refund for pulse multi-kills. Breaker unlocks after three cumulative district clears: more hull and blade damage, fewer pulses, and hull recovery on melee kills. Losses and abandoned runs contribute. Locks show progress, and swiping between kits explains their passive effect. Unlocks are local to this browser/device and are lost if its app data is cleared.

The game waits indefinitely for input. Saves occur at completed turns and upgrade selections. No accounts, telemetry, server, phone controller, sensors, or runtime third-party downloads. Sound is optional and starts disabled. Field kit → Travel readiness reports local cache/save status and the last map draw time; this is not a hardware benchmark.

## Develop and verify

Requires Node.js 24+.

```text
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run dev
```

Preview at `http://127.0.0.1:4173/rogue-vision/`. Rebuild after editing. Arrow keys, Enter and Escape reproduce the discrete control vocabulary. The preview deliberately uses the same subpath as GitHub Pages.

`src/game.js` owns the seeded simulation and versioned save validation; `src/input.js` handles wrist keyCode-first normalization and duplicate filtering; `src/render.js` draws code-native art; `src/app.js` owns menus, persistence and shallow history. The build bundles fonts and produces a PNG icon and content-versioned offline shell. Service workers retain a coherent release until old tabs close and remove only this app's caches.

`src/kits.js` defines starting equipment; `src/profile.js` keeps a separate versioned progression record. It awards positive run deltas once and retains the last durable run receipt until a replacement save succeeds. Legacy run saves and stats migrate locally. Tests cover failed writes between the profile and run snapshots, including repeated failed new-run attempts.

GitHub Actions runs unit and browser checks, then publishes `dist/` on `main`. Configure Pages to use GitHub Actions. No production Node server is needed.

## Platform evidence

Implementation checked against Meta's [Web App AI Toolkit](https://github.com/facebook/meta-wearables-webapp), its display/performance and offline guidance, and the public Wearables documentation MCP. The local knowledge vault adds first-hand wrist event measurements. The design intentionally uses discrete input and event-driven drawing rather than assuming a continuous gesture or GPU budget.

Desktop browser tests verify cold offline reload, save restoration and keyboard navigation. Actual glasses legibility, input reliability, device offline relaunch and sustained battery use still require hardware testing.

Fonts: Oxanium and Atkinson Hyperlegible, distributed locally under the SIL Open Font License; license copies accompany the build. FOGFALL is an independent game, not an official Meta or Salesforce product.
