import test from "node:test";
import assert from "node:assert/strict";
import {
  newRun,
  chooseUpgrade,
  act,
  encodeSave,
  decodeSave,
} from "../src/game.js";
import { distances } from "../src/districts.js";
function chinatown(seed = 2, rules = 2) {
  const s = newRun(seed, "courier", rules);
  s.phase = "upgrade";
  s.choices = ["blade", "shell", "power"];
  chooseUpgrade(s, "blade");
  return s;
}
test("new Chinatown relays are reachable and distinct from supplies and encounters", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = chinatown(seed),
      r = s.relay;
    assert.ok(r);
    assert.equal(r.progress, 0);
    assert.equal(s.tiles[r.y][r.x], 0);
    assert.ok(distances(s.tiles, s.exit).get(`${r.x},${r.y}`) <= 6);
    for (const p of [s.exit, s.landmark, ...s.items, ...s.enemies])
      assert.ok(p.x !== r.x || p.y !== r.y);
    assert.deepEqual(chinatown(seed).relay, r);
    const old = chinatown(seed, 1);
    for (const key of ["tiles", "enemies", "items", "rng"])
      assert.deepEqual(s[key], old[key]);
  }
});

test("walking away preserves work, blocked input does not advance it, and threats still land", () => {
  const s = chinatown();
  s.enemies = [];
  Object.assign(s.player, s.relay);
  act(s, "wait");
  const r = { ...s.relay };
  Object.assign(s.player, { x: 1, y: 1 });
  act(s, "left");
  assert.deepEqual(s.relay, r);
  Object.assign(s.player, r);
  s.enemies = [
    {
      id: 99,
      kind: "husk",
      x: 1,
      y: 1,
      hp: 6,
      maxHp: 6,
      stun: 0,
      intent: [{ x: r.x, y: r.y }],
    },
  ];
  const hp = s.player.hp;
  act(s, "wait");
  assert.equal(s.relay.progress, 2);
  assert.ok(s.player.hp < hp);
});

test("a distant pulse does not power the relay", () => {
  const s = chinatown();
  s.enemies = [];
  s.player.pulseRange = 1;
  act(s, "pulse");
  assert.equal(s.relay.progress, 0);
});
test("manual relay work costs real turns, saves progress, and completes with no pulses", () => {
  const s = chinatown();
  s.enemies = [];
  s.player.charges = 0;
  Object.assign(s.player, s.relay);
  act(s, "wait");
  assert.equal(s.relay.progress, 1);
  const saved = decodeSave(encodeSave(s));
  assert.equal(saved.relay.progress, 1);
  act(saved, "wait");
  act(saved, "wait");
  assert.equal(saved.relay.progress, 3);
  Object.assign(saved.player, saved.exit);
  act(saved, "wait");
  assert.equal(saved.phase, "upgrade");
});
test("pulse shortcuts relay work within actual pulse range and cannot work without a charge", () => {
  const s = chinatown();
  s.enemies = [];
  Object.assign(s.player, s.relay);
  s.player.charges = 0;
  const turn = s.turn;
  assert.equal(act(s, "pulse"), false);
  assert.equal(s.turn, turn);
  assert.equal(s.relay.progress, 0);
  s.player.charges = 1;
  act(s, "pulse");
  assert.equal(s.relay.progress, 3);
  assert.equal(s.player.charges, 0);
});
test("a dark uplink cannot skip the objective and old expeditions keep their original future districts", () => {
  const current = chinatown();
  current.enemies = [];
  Object.assign(current.player, current.exit);
  act(current, "wait");
  assert.equal(current.phase, "playing");
  assert.match(current.message, /relay/i);
  const old = newRun(2);
  delete old.rules;
  const restored = decodeSave(encodeSave(old));
  restored.phase = "upgrade";
  restored.choices = ["blade", "shell", "power"];
  chooseUpgrade(restored, "blade");
  assert.equal(restored.relay, undefined);
  restored.enemies = [];
  Object.assign(restored.player, restored.exit);
  act(restored, "wait");
  assert.equal(restored.phase, "upgrade");
});
test("relay save validation rejects missing, misplaced and impossible progress", () => {
  const s = chinatown();
  for (const mutate of [
    (r) => delete r.relay,
    (r) => (r.relay.progress = 4),
    (r) => (r.relay.x = 0),
    (r) => (r.rules = 9),
    (r) => (r.relay = { ...r.exit, progress: 0 }),
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.equal(decodeSave(encodeSave(bad)), null);
  }
  assert.ok(decodeSave(encodeSave(s)));
});
