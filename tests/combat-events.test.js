import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game.js";

function arena() {
  const s = game.newRun(123);
  s.tiles = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) => +(x === 0 || y === 0 || x === 10 || y === 10)),
  );
  Object.assign(s.player, { x: 5, y: 5 });
  s.enemies = [];
  s.items = [];
  delete s.landmark;
  game.reveal(s);
  return s;
}
const enemy = (id, x, y, hp = 6, kind = "husk", intent = []) =>
  ({ id, x, y, hp, maxHp: hp, kind, intent, stun: 0 });
const events = s => game.combatEvents?.(s) ?? [];

test("combat records actual hull removed, simultaneous retaliation and no saved effects", () => {
  const s = arena();
  s.player.hp = 10;
  s.player.siphon = 2;
  s.enemies = [enemy(1, 6, 5, 1), enemy(2, 4, 5, 6, "husk", [{ x: 5, y: 5 }])];
  game.act(s, "right");
  assert.equal(events(s).find(e => e.kind === "melee")?.amount, 1, "overkill is not extra hull loss");
  assert.equal(events(s).find(e => e.kind === "damage")?.amount, 4, "healing does not hide incoming damage");
  assert.equal(s.player.hp, 8);
  const copy = events(s);
  copy[0].to.x = 99;
  assert.notEqual(events(s)[0].to.x, 99, "consumers cannot alter later effects");
  const restored = game.decodeSave(game.encodeSave(s));
  assert.deepEqual(restored, s);
  assert.deepEqual(events(restored), []);
  game.act(s, "invalid");
  assert.deepEqual(events(s), []);
});

test("pulse records its footprint and targets, and cancelled attacks never fire", () => {
  const s = arena();
  s.enemies = [enemy(1, 6, 5, 1, "spitter", [{ x: 5, y: 5 }]), enemy(2, 4, 5, 6)];
  game.act(s, "pulse");
  assert.equal(events(s).find(e => e.kind === "pulse")?.range, 2);
  assert.deepEqual(events(s).filter(e => e.kind === "impact").map(e => e.amount), [1, s.player.pulseDamage]);
  assert.ok(!events(s).some(e => ["shot", "swipe", "damage"].includes(e.kind)));
  s.player.charges = 0;
  game.act(s, "pulse");
  assert.deepEqual(events(s), []);
});

test("enemy shots and Conductor bursts retain missed target squares", () => {
  for (const [kind, effect] of [["spitter", "shot"], ["conductor", "blast"]]) {
    const s = arena();
    s.enemies = [enemy(1, 5, 2, 20, kind, [{ x: 5, y: 5 }])];
    game.act(s, "right");
    const shot = events(s).find(e => e.kind === effect);
    assert.deepEqual(shot?.from, { x: 5, y: 2 });
    assert.deepEqual(shot?.to, { x: 5, y: 5 });
    assert.equal(shot?.visible, true);
    assert.ok(!events(s).some(e => e.kind === "damage"));
  }
});

test("unseen attack origins are marked private while player damage stays observable", () => {
  const s = arena();
  s.enemies = [enemy(1, 5, 2, 20, "conductor", [{ x: 5, y: 5 }])];
  s.visible[2][5] = false;
  game.act(s, "wait");
  assert.equal(events(s).find(e => e.kind === "blast")?.visible, false);
  assert.equal(events(s).find(e => e.kind === "damage")?.visible, true);
});
