import test from "node:test";
import assert from "node:assert/strict";
import {
  newRun,
  act,
  chooseUpgrade,
  chooseEncounter,
  encodeSave,
  decodeSave,
} from "../src/game.js";
import { simulate } from "../scripts/balance/simulation.mjs";

test("district encounter budgets increase pressure without crowding the opening", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const s = newRun(Math.imul(seed, 2654435761) >>> 0);
    for (const count of [6, 8, 10, 7]) {
      assert.equal(s.enemies.length, count);
      const actors = [...s.enemies, ...s.items, s.landmark, s.player, s.exit];
      assert.equal(
        new Set(actors.map((p) => `${p.x},${p.y}`)).size,
        actors.length,
      );
      assert.ok(
        s.enemies.every(
          (e) =>
            Math.abs(e.x - 1) + Math.abs(e.y - 1) >= 4 && e.intent.length === 0,
        ),
      );
      const restored = decodeSave(encodeSave(s));
      assert.deepEqual(restored, s);
      const hp = s.player.hp;
      act(s, "right");
      if (s.floor < 3) act(s, "down");
      assert.equal(
        s.player.hp,
        hp,
        "early districts allow two safe opening moves; the boss can warn on entry",
      );
      if (s.floor === 3) break;
      s.phase = "upgrade";
      s.choices = ["blade"];
      chooseUpgrade(s, "blade");
    }
  }
});

test("ordinary enemies punish repeated mistakes while strikes remain telegraphed", () => {
  const s = newRun(1);
  s.enemies = [
    { id: 0, kind: "runner", hp: 4, maxHp: 4, x: 2, y: 1, intent: [], stun: 0 },
  ];
  s.items = [];
  const hp = s.player.hp;
  act(s, "right");
  assert.equal(
    s.enemies[0].hp,
    1,
    "a starting Courier no longer one-shots a Runner",
  );
  assert.equal(s.player.hp, hp);
  assert.deepEqual(s.enemies[0].intent, [{ x: 1, y: 1 }]);
  const dodge = structuredClone(s);
  act(dodge, "down");
  assert.equal(dodge.player.hp, hp);
  act(s, "wait");
  assert.equal(s.player.hp, hp - 4);
});

test("landmark reinforcements use the same runner durability as district enemies", () => {
  const s = newRun(1);
  s.floor = 2;
  s.phase = "encounter";
  const lastId = Math.max(...s.enemies.map((e) => e.id));
  chooseEncounter(s, "take");
  const reinforcements = s.enemies.filter((e) => e.id > lastId);
  assert.equal(reinforcements.length, 2);
  assert.ok(reinforcements.every((e) => e.hp === 4 && e.maxHp === 4));
});

test("a reckless seeded expedition can die before Moscone", () => {
  const result = simulate({
    seed: 11,
    kit: "courier",
    policy: "direct",
    maxTurns: 400,
  });
  assert.equal(result.outcome, "dead");
  assert.equal(result.districts.at(-1).district, 2);
});

test("saved expeditions keep their original damage and future encounter budgets", () => {
  const s = newRun(1);
  delete s.balance;
  s.player.hp = 3;
  s.items = [];
  s.enemies = [
    {
      id: 0,
      kind: "runner",
      hp: 3,
      maxHp: 3,
      x: 2,
      y: 1,
      intent: [{ x: 1, y: 1 }],
      stun: 0,
    },
  ];
  const old = decodeSave(encodeSave(s));
  assert.deepEqual(old, s);
  act(old, "wait");
  assert.equal(
    old.player.hp,
    1,
    "resuming must not make an existing warning more lethal",
  );
  old.phase = "upgrade";
  old.choices = ["blade"];
  chooseUpgrade(old, "blade");
  assert.equal(old.enemies.length, 5);
  assert.ok(
    old.enemies.filter((e) => e.kind === "runner").every((e) => e.hp === 3),
  );
  const current = newRun(1);
  assert.equal(current.balance, 2);
  current.balance = 99;
  assert.equal(decodeSave(encodeSave(current)), null);
});
