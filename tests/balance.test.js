import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game.js";
import fixture from "./fixtures/expedition.json" with { type: "json" };

function arena() {
  const s = game.newRun(123, "breaker");
  s.tiles = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) =>
      x === 0 || y === 0 || x === 10 || y === 10 ? 1 : 0,
    ),
  );
  Object.assign(s.player, { x: 5, y: 5, hp: 20 });
  s.enemies = [
    { id: 0, kind: "runner", x: 6, y: 5, hp: 3, maxHp: 3, intent: [], stun: 0 },
    {
      id: 1,
      kind: "spitter",
      x: 5,
      y: 7,
      hp: 4,
      maxHp: 4,
      intent: [{ x: 5, y: 5 }],
      stun: 0,
    },
  ];
  s.items = [{ x: 5, y: 5, kind: "med" }];
  return s;
}

test("measure actual healing and damage separately when both occur in one action", () => {
  assert.equal(typeof game.actionMetrics, "function");
  const s = arena();
  game.act(s, "right");
  assert.equal(s.player.hp, 21);
  assert.deepEqual(game.actionMetrics(s), {
    damageTaken: 3,
    healing: 4,
    healingWasted: 2,
    hullSpent: 0,
    pickups: ["med"],
  });
  const copy = game.actionMetrics(s);
  copy.pickups.push("cell");
  assert.deepEqual(game.actionMetrics(s).pickups, ["med"]);
  assert.ok(!game.encodeSave(s).includes("healingWasted"));
  game.act(s, "invalid");
  assert.equal(game.actionMetrics(s).damageTaken, 0);
});

test("landmark hull costs and upgrade healing have separate accounting", () => {
  assert.equal(typeof game.actionMetrics, "function");
  const s = arena();
  s.floor = 1;
  s.phase = "encounter";
  s.landmark.resolved = false;
  game.chooseEncounter(s, "take");
  assert.equal(game.actionMetrics(s).hullSpent, 3);
  assert.equal(game.actionMetrics(s).damageTaken, 0);
  s.phase = "upgrade";
  s.choices = ["shell"];
  game.chooseUpgrade(s, "shell");
  assert.equal(game.actionMetrics(s).healing, 9);
  assert.equal(game.actionMetrics(s).healingWasted, 0);
});

test("measurement preserves the existing real expedition exactly", () => {
  const s = game.newRun(fixture.seed);
  for (const action of fixture.actions) {
    const ok = action.startsWith("upgrade:")
      ? game.chooseUpgrade(s, action.slice(8))
      : action.startsWith("encounter:")
        ? game.chooseEncounter(s, action.slice(10))
        : game.act(s, action);
    assert.ok(ok);
  }
  for (const [key, value] of Object.entries(fixture.expected))
    assert.equal(s[key], value);
});

test("policies cannot observe hidden actors, supplies or terrain", async () => {
  const { observe, decide, newMemory } =
    await import("../scripts/balance/policies.mjs");
  const s = game.newRun(7);
  const before = game.encodeSave(s);
  const observation = observe(s);
  const hidden = structuredClone(s);
  hidden.enemies.push({
    id: 999,
    x: 9,
    y: 9,
    kind: "conductor",
    hp: 999,
    intent: [],
  });
  hidden.items.push({ x: 9, y: 9, kind: "cell" });
  hidden.tiles[9][9] = 1;
  assert.deepEqual(observe(hidden), observation);
  for (const name of ["direct", "scavenger", "tactical"]) {
    assert.equal(
      decide(observation, newMemory(42), name),
      decide(observe(hidden), newMemory(42), name),
    );
  }
  assert.equal(game.encodeSave(s), before);
  assert.equal(observation.tiles[9][9], null);
  assert.ok(!("rng" in observation));
});

test("runs are reproducible, exactly replayable, and caps are not deaths", async () => {
  const { simulate, replay } =
    await import("../scripts/balance/simulation.mjs");
  const config = { seed: 5, kit: "relay", policy: "tactical", maxTurns: 80 };
  const a = simulate(config),
    b = simulate(config);
  assert.deepEqual(a, b);
  assert.equal(replay(a).digest, a.digest);
  assert.equal(a.damageTaken + a.hullSpent - a.healing, a.initialHp - a.hp);
  const capped = simulate({ ...config, maxTurns: 1 });
  assert.equal(capped.outcome, "capped");
  assert.equal(capped.turns, 1);
  assert.throws(() => replay({ ...a, digest: "wrong" }), /Replay mismatch/);
});

test("upgrade experiments clone the same state and preserve offered choices", async () => {
  const { compareUpgrades, simulate } =
    await import("../scripts/balance/simulation.mjs");
  const { newMemory } = await import("../scripts/balance/policies.mjs");
  const s = game.newRun(fixture.seed);
  for (const action of fixture.actions) {
    if (action.startsWith("upgrade:")) break;
    game.act(s, action);
  }
  const before = game.encodeSave(s);
  const memory = newMemory(99);
  const rows = compareUpgrades(s, memory, {
    policy: "tactical",
    maxTurns: 120,
  });
  assert.deepEqual(
    rows.map((r) => r.choice),
    s.choices,
  );
  assert.equal(new Set(rows.map((r) => r.result.initialState)).size, 1);
  for (const row of rows) {
    assert.equal(row.result.districts[0].cleared, true);
    assert.equal(row.result.actions[0], `upgrade:${row.choice}`);
    assert.deepEqual(
      row.result,
      simulate({
        state: s,
        memory,
        policy: "tactical",
        maxTurns: 120,
        firstUpgrade: row.choice,
      }),
    );
  }
  assert.equal(game.encodeSave(s), before);
  assert.deepEqual(memory, newMemory(99));
});

test("reports keep unfinished runs separate and include district denominators", async () => {
  const { summarize } = await import("../scripts/balance/report.mjs");
  const { simulate } = await import("../scripts/balance/simulation.mjs");
  const capped = simulate({ seed: 1, maxTurns: 1 });
  const summary = summarize([capped])[0];
  assert.deepEqual(summary.outcomes, {
    won: 0,
    dead: 0,
    capped: 1,
    stalled: 0,
  });
  assert.equal(summary.observedWinFraction, 0);
  assert.equal(summary.unresolvedFraction, 1);
  assert.equal(summary.districts[0].entered, 1);
  assert.equal(summary.districts[0].cleared, 0);
  assert.equal(summary.districts[0].unresolved, 1);
  assert.equal(summary.districts[1].entered, 0);
  assert.equal(summary.districts[1].clearFraction, null);
});

test("unlock sessions credit real partial runs once and remain reproducible", async () => {
  const { unlockSession } = await import("../scripts/balance/report.mjs");
  const config = { seed: 9, policy: "tactical", maxTurns: 30, sessionRuns: 3 };
  const a = unlockSession(config);
  assert.deepEqual(a, unlockSession(config));
  assert.equal(
    a.profile.kills,
    a.runs.reduce((n, r) => n + r.kills, 0),
  );
  assert.equal(
    a.profile.districts,
    a.runs.reduce((n, r) => n + r.districts.filter((d) => d.cleared).length, 0),
  );
  assert.equal(a.profile.runs, a.runs.length);
  for (const id of ["relay", "breaker"])
    if (a.unlocks[id]) {
      assert.ok(a.unlocks[id].run >= 1 && a.unlocks[id].run <= a.runs.length);
    }
});

test("CLI rejects malformed experiment sizes and exposes replay mode", async () => {
  const { parseArgs } = await import("../scripts/balance/report.mjs");
  assert.throws(() => parseArgs(["--runs", "-1"]), /runs/);
  assert.throws(() => parseArgs(["--seed", "NaN"]), /seed/);
  assert.throws(() => parseArgs(["--max-turns", "0"]), /max-turns/);
  assert.throws(() => parseArgs(["--policies", "omniscient"]), /policies/);
  assert.throws(() => parseArgs(["--bogus"]), /Unknown/);
  assert.equal(parseArgs(["--replay", "report.json", "--row", "2"]).row, 2);
});

test("a repeated dodge cycle is reported as a bot stall, not an impossible seed", async () => {
  const { simulate, replay } =
    await import("../scripts/balance/simulation.mjs");
  const row = simulate({
    seed: 6,
    kit: "relay",
    policy: "tactical",
    maxTurns: 400,
  });
  assert.equal(row.outcome, "stalled");
  assert.equal(row.reason, "repeated-state");
  assert.equal(row.turns, 400);
  assert.equal(replay(row).phase, "playing");
});

test("cycle diagnostics allow exploration memory time to escape repeated states", async () => {
  const { simulate } = await import("../scripts/balance/simulation.mjs");
  const row = simulate({
    seed: 1,
    kit: "courier",
    policy: "tactical",
    maxTurns: 400,
  });
  assert.equal(row.outcome, "won");
});

test("the selected upgrade continuation matches the original policy's final state", async () => {
  const { simulate } = await import("../scripts/balance/simulation.mjs");
  const row = simulate({
    seed: 2,
    policy: "direct",
    maxTurns: 200,
    forks: true,
  });
  assert.ok(row.upgradeComparisons.length > 0);
  assert.ok(row.districts.every((d) => d.partial === false));
  for (const checkpoint of row.upgradeComparisons) {
    const baseline = checkpoint.alternatives.find(
      (a) => a.choice === checkpoint.selected,
    ).result;
    assert.equal(baseline.digest, row.digest);
    assert.ok(baseline.initialMemory);
  }
});

test("cancelling one attacker does not erase another attack on the same tile", async () => {
  const { observe } = await import("../scripts/balance/policies.mjs");
  const s = arena();
  s.enemies[0].intent = [{ x: 5, y: 5 }];
  game.reveal(s);
  const o = observe(s);
  assert.equal(o.threats.filter((p) => p.x === 5 && p.y === 5).length, 2);
  assert.ok(o.threats.every((p) => typeof p.source === "number"));
});
