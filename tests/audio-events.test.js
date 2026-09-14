import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game.js";

const events = (s) => game.actionEvents?.(s) ?? [];
function arena() {
  const s = game.newRun(123);
  s.tiles = Array.from({ length: 11 }, (_, y) =>
    Array.from(
      { length: 11 },
      (_, x) => +(x === 0 || y === 0 || x === 10 || y === 10),
    ),
  );
  Object.assign(s.player, { x: 5, y: 5 });
  s.enemies = [];
  s.items = [];
  delete s.landmark;
  return s;
}
const enemy = (id, x, y, hp = 5, intent = []) => ({
  id,
  x,
  y,
  hp,
  maxHp: 5,
  kind: "husk",
  intent,
  stun: 0,
});

test("uplinks and final extraction emit explicit musical milestones", () => {
  for (const [floor, milestone] of [
    [0, "uplink"],
    [3, "won"],
  ]) {
    const s = arena();
    s.floor = floor;
    Object.assign(s.player, { x: 8, y: 9 });
    game.act(s, "right");
    assert.ok(events(s).includes(milestone));
    game.act(s, "right");
    assert.deepEqual(
      events(s),
      [],
      "inactive actions cannot replay the cadence",
    );
  }
});
test("a kill and retaliation survive together while the visual event stays damage", () => {
  const s = arena();
  s.enemies = [enemy(1, 6, 5, 1), enemy(2, 4, 5, 5, [{ x: 5, y: 5 }])];
  game.act(s, "right");
  assert.equal(s.event, "damage");
  assert.deepEqual(events(s), ["hit", "kill", "damage"]);
});
test("pulse multi-kills collapse to one outcome and sound never enters a save", () => {
  const s = arena();
  s.enemies = [enemy(1, 6, 5, 1), enemy(2, 4, 5, 1)];
  game.act(s, "pulse");
  assert.deepEqual(events(s), ["pulse", "kill"]);
  const restored = game.decodeSave(game.encodeSave(s));
  assert.deepEqual(restored, s);
  assert.deepEqual(events(restored), []);
});
test("newly imminent danger warns once and blocked inputs do not repeat it", () => {
  const s = arena();
  s.enemies = [enemy(1, 6, 5)];
  game.act(s, "wait");
  assert.deepEqual(events(s), ["wait", "warning"]);
  s.player.charges = 0;
  game.act(s, "pulse");
  assert.deepEqual(events(s), ["blocked"]);
  game.act(s, "up");
  assert.deepEqual(events(s), ["move"]);
});
test("landmarks distinguish refusal, acceptance and leaving without spending turns", () => {
  for (const [choice, charges, cue] of [
    ["take", 0, "blocked"],
    ["take", 2, "trade"],
    ["leave", 2, "leave"],
  ]) {
    const s = arena();
    s.phase = "encounter";
    s.landmark = { x: 5, y: 5, resolved: false };
    s.player.charges = charges;
    game.chooseEncounter(s, choice);
    assert.deepEqual(events(s), [cue]);
    assert.equal(s.turn, 0);
  }
});
test("death preserves the fatal outcome; upgrade emits arrival once", () => {
  const s = arena();
  s.player.hp = 1;
  s.enemies = [enemy(1, 6, 5, 5, [{ x: 5, y: 5 }])];
  game.act(s, "wait");
  assert.ok(events(s).includes("dead"));
  const u = arena();
  Object.assign(u.player, { x: 8, y: 9 });
  game.act(u, "right");
  game.chooseUpgrade(u, u.choices[0]);
  assert.deepEqual(events(u), ["arrival"]);
});
