# Balance experiments

Run from the repository root with Node.js 24+. No browser or additional dependencies are needed.

```text
npm run balance
npm run balance -- --runs 100 --seed 1 --forks --sessions 20
npm run balance -- --kits relay --policies tactical --seed 6 --runs 1 --sessions 0
npm run balance -- --replay .artifacts/balance/report.json --row 0
```

The default is 30 matched seeds × three kits × three policies, a 400-turn cap, and five unlock sessions per policy (at most ten runs per session). `--forks` additionally continues every offered upgrade from identical pre-choice states. It substantially increases runtime and report size. Reports overwrite `report.json` and `report.md` in the selected `--output` directory; use distinct directories to retain experiments. `.artifacts/` is ignored and excluded from production.

## Policies and information

All policies use the real `newRun`, `act`, `chooseUpgrade` and `chooseEncounter` functions. They receive remembered terrain, currently visible enemies and supplies, visible threat markings, their current equipment, and the publicly stated uplink coordinates. They can remember previously seen supplies. Unexplored terrain, hidden enemies/supplies and the world's RNG state are unavailable. Policies have separate seeded tie-breaking and explicit memory; changing a kit does not change world generation for the matched seed.

- **direct:** prioritizes the uplink, tolerates more marked-tile risk, declines landmark trades and does not plan supply detours. It still fights and uses pulses.
- **scavenger:** avoids marked strikes more strongly and detours for useful resources, landmarks and score pickups.
- **tactical:** uses the same stronger avoidance and resource-aware upgrade priorities, but does not seek score-only detours.

These are related heuristic probes, not independent optimal solvers or calibrated novice/expert humans. They use known combat rules, not full-state engine rollouts, to score immediate actions. They may miss multi-turn plans, misjudge hidden threats or get stuck dodging. Their deterministic upgrade preference orders are visible in `policies.mjs`; `--forks` tests alternatives to those preferences. Bump `POLICY_VERSION` when changing decision behavior; preserve old reports and the corresponding source revision.

## Outcomes and pressure

`won` and `dead` are game endings. `capped` means the absolute expedition turn limit was reached. `stalled` means the policy stopped, proposed a rejected action, hit a decision limit, or reached the turn cap in a tactical state visited at least eight times. The repeated-state diagnostic preserves combat-relevant turn and melee-hit parity, but ignores message text and policy memory. It is evaluated only at the cap, allowing exploration memory time to escape repeated states. It does not prove that the engine is stuck or the seed is unwinnable. A cap at an upgrade screen credits the cleared district without inventing entry into the next one. Continuations label their initial district record as partial when starting after turn zero.

Summary win fractions use **all started runs**, with unresolved fractions shown separately in JSON and counts in Markdown. Distribution quantiles use the lower observed order statistic. Distribution samples include unfinished observations, so their turn totals do not estimate completed-run lifetimes. No confidence or human win-rate claim follows from these samples.

Each entered district records its denominator, clearance/death/unresolved counts, damage, minimum/entry/exit hull, empty-charge turns, combat exposure, marked-threat turns, kills, pickups and landmark choices. Damage counts actual hull lost to enemy strikes, capped at remaining hull on a lethal hit. Landmark hull costs are separate. Healing counts actual restoration and waste separately, including same-action healing followed by damage. Minimum hull is sampled after each action. Empty-charge turns use the post-action charge count; exposure and threat turns use the pre-action visible observation. Between-district upgrade healing is stored separately in each raw run, and included in total healing. Later-district cohorts contain only survivors: inspect conditional clearance and entry resources together.

## Upgrade comparisons and unlocks

Each upgrade checkpoint preserves the identical save, policy memory and offered choices, then forces each offered upgrade and resumes the same policy with the same absolute turn cap. Continuations do not recursively fork. JSON includes every transcript plus contextual comparisons against the policy's selected choice, grouped by kit, policy, district and preceding build. Win differences exclude pairs with either run unresolved; final hull differences include only pairs where both win. Neither conditional statistic is an overall causal item ranking. The raw outcomes keep excluded pairs reviewable. Items not offered are not tested, and alternative policies could value an upgrade differently.

Unlock sessions start fresh profiles, stay on Courier and use production `trackRun`, `acknowledgeRun`, `creditRun` and `kitUnlocked` functions at every accepted action. Session seeds advance consecutively, wrapping as uint32; consecutive sessions start `--session-runs` seeds apart. Unlock timestamps record the first run and turn that earns each kit. Sessions stop after both kits unlock or the run limit. Unfinished expeditions are explicitly abandoned between session runs; earned progress remains. Reports show how many sessions reached each unlock, with medians conditional on reaching it. These sessions measure these bots' progression, not human learning or the browser's persistence failure handling.

## Reproducibility and maintenance

Every report records schema/policy versions, exact inputs, Git revision, working-tree dirty status and a SHA-256 fingerprint of the engine, profile, policy and harness source files. Every run includes its initial save, accepted actions and final state digest. Replay dispatches those actions through the real engine and fails if the digest differs. It does not re-run the bot. Upgrade and session transcripts can also be passed to the exported `replay(row)` function. Replay against the recorded revision; a changed engine may correctly reject an old digest.

`simulation.mjs` owns execution and measurement, `policies.mjs` owns decisions, `report.mjs` owns aggregation/unlock experiments, and `measure-balance.mjs` owns CLI/file output. Transient `actionMetrics` counters in the game engine are not saved and do not change rules or world randomness. Unit tests cover same-action accounting, the existing victory fixture, observation privacy, determinism, branching, censoring, unlock credit and replay. Human playtests remain necessary to set challenge targets before tuning.
