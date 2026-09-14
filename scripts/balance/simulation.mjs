import { createHash } from "node:crypto";
import {
  newRun,
  act,
  chooseUpgrade,
  chooseEncounter,
  encodeSave,
  decodeSave,
  actionMetrics,
} from "../../src/game.js";
import {
  observe,
  decide,
  newMemory,
  POLICIES,
  POLICY_VERSION,
} from "./policies.mjs";

const digest = (s) => createHash("sha256").update(encodeSave(s)).digest("hex");
const measurementKeys = [
  "damageTaken",
  "healing",
  "healingWasted",
  "hullSpent",
];
const dispatch = (s, action) =>
  action.startsWith("upgrade:")
    ? chooseUpgrade(s, action.slice(8))
    : action.startsWith("encounter:")
      ? chooseEncounter(s, action.slice(10))
      : act(s, action);

function district(s) {
  return {
    district: s.floor + 1,
    entryTurn: s.turn,
    entryHp: s.player.hp,
    entryMaxHp: s.player.maxHp,
    entryCharges: s.player.charges,
    relics: [...s.relics],
    turns: 0,
    damageTaken: 0,
    healing: 0,
    healingWasted: 0,
    hullSpent: 0,
    minHp: s.player.hp,
    emptyChargeTurns: 0,
    exposedTurns: 0,
    threatenedTurns: 0,
    kills: 0,
    pickups: { med: 0, cell: 0, signal: 0 },
    encounters: [],
    cleared: ["upgrade", "won"].includes(s.phase),
    partial: s.turn > 0,
    exitHp: s.player.hp,
    exitMaxHp: s.player.maxHp,
    exitCharges: s.player.charges,
  };
}

export function simulate({
  seed = 1,
  kit = "courier",
  policy = "tactical",
  maxTurns = 400,
  state,
  memory,
  firstUpgrade,
  forks = false,
  onStep,
} = {}) {
  if (!POLICIES.includes(policy)) throw Error(`Unknown policy: ${policy}`);
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 100000)
    throw Error("Invalid maxTurns");
  const s = state ? structuredClone(state) : newRun(seed, kit);
  const m = memory
    ? structuredClone(memory)
    : newMemory((s.seed ^ 0x9e3779b9) >>> 0);
  const initialState = encodeSave(s),
    initialHp = s.player.hp;
  const initialMemory = structuredClone(m);
  const actions = [],
    districts = [district(s)],
    upgradeComparisons = [],
    transitionHealing = [];
  const total = Object.fromEntries(measurementKeys.map((k) => [k, 0]));
  const repeats = new Map();
  let outcome, reason;
  while (!["won", "dead"].includes(s.phase)) {
    // Diagnose cycles only at the turn cap: memory can escape repeated world
    // states. A cycle is a policy limitation, not proof of an engine deadlock.
    const repeatKey = digest({
      ...s,
      turn: s.turn % 2,
      meleeHits: s.meleeHits % 2,
      message: "",
      event: "",
    });
    const repeated = (repeats.get(repeatKey) ?? 0) + 1;
    repeats.set(repeatKey, repeated);
    if (s.turn >= maxTurns) {
      outcome = repeated >= 8 ? "stalled" : "capped";
      reason = repeated >= 8 ? "repeated-state" : "turn-limit";
      break;
    }
    if (actions.length >= maxTurns * 3 + 12) {
      outcome = "stalled";
      reason = "decision-limit";
      break;
    }
    if (forks && s.phase === "upgrade") {
      upgradeComparisons.push({
        district: s.floor + 1,
        stateDigest: digest(s),
        relics: [...s.relics],
        selected: decide(observe(s), structuredClone(m), policy).slice(8),
        alternatives: compareUpgrades(s, m, { policy, maxTurns }),
      });
    }
    const observation = observe(s);
    const action =
      !actions.length && firstUpgrade
        ? `upgrade:${firstUpgrade}`
        : decide(observation, m, policy);
    if (!action) {
      outcome = "stalled";
      reason = "policy-stopped";
      break;
    }
    const prior = {
      floor: s.floor,
      turn: s.turn,
      kills: s.kills,
      phase: s.phase,
    };
    if (!dispatch(s, action)) {
      outcome = "stalled";
      reason = `rejected:${action}`;
      break;
    }
    actions.push(action);
    const measured = actionMetrics(s);
    for (const k of measurementKeys) total[k] += measured[k];
    if (s.floor !== prior.floor) {
      transitionHealing.push({
        afterDistrict: prior.floor + 1,
        choice: action.slice(8),
        ...measured,
      });
      districts.push(district(s));
    } else {
      const d = districts.at(-1);
      for (const k of measurementKeys) d[k] += measured[k];
      for (const item of measured.pickups) d.pickups[item]++;
      d.kills += s.kills - prior.kills;
      if (s.turn > prior.turn) {
        d.turns++;
        if (observation.enemies.length) d.exposedTurns++;
        if (
          observation.threats.some(
            (p) => p.x === observation.player.x && p.y === observation.player.y,
          )
        )
          d.threatenedTurns++;
        if (s.player.charges === 0) d.emptyChargeTurns++;
      }
      if (action.startsWith("encounter:")) d.encounters.push(action.slice(10));
      d.minHp = Math.min(d.minHp, s.player.hp);
      Object.assign(d, {
        exitHp: s.player.hp,
        exitMaxHp: s.player.maxHp,
        exitCharges: s.player.charges,
        cleared: ["upgrade", "won"].includes(s.phase),
      });
    }
    onStep?.(s);
  }
  outcome ??= s.phase === "won" ? "won" : "dead";
  return {
    seed: s.seed,
    kit: s.kit ?? "courier",
    policy,
    policyVersion: POLICY_VERSION,
    maxTurns,
    initialState,
    initialMemory,
    forcedUpgrade: firstUpgrade ?? null,
    initialHp,
    actions,
    outcome,
    ...(reason ? { reason } : {}),
    phase: s.phase,
    turns: s.turn,
    hp: s.player.hp,
    maxHp: s.player.maxHp,
    score: s.score,
    kills: s.kills,
    relics: [...s.relics],
    ...total,
    districts,
    transitionHealing,
    upgradeComparisons,
    digest: digest(s),
  };
}

export function compareUpgrades(state, memory, config) {
  if (state.phase !== "upgrade")
    throw Error("Upgrade comparison requires a choice state");
  return state.choices.map((choice) => ({
    choice,
    result: simulate({
      ...config,
      state,
      memory,
      firstUpgrade: choice,
      forks: false,
      onStep: undefined,
    }),
  }));
}

export function replay(row) {
  const s = decodeSave(row.initialState);
  if (!s) throw Error("Invalid replay initial state");
  for (const action of row.actions)
    if (!dispatch(s, action)) throw Error(`Rejected replay action: ${action}`);
  const actual = digest(s);
  if (actual !== row.digest)
    throw Error(`Replay mismatch: expected ${row.digest}, received ${actual}`);
  return {
    digest: actual,
    phase: s.phase,
    turn: s.turn,
    hp: s.player.hp,
    score: s.score,
  };
}
