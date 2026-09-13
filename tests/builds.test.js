import test from "node:test";
import assert from "node:assert/strict";
import {
  newRun,
  act,
  encodeSave,
  decodeSave,
  chooseUpgrade,
} from "../src/game.js";
import { KITS } from "../src/kits.js";
const arena = (kit = "courier") => {
  const s = newRun(1, kit);
  s.tiles = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) =>
      x === 0 || y === 0 || x === 10 || y === 10 ? 1 : 0,
    ),
  );
  s.player.x = 4;
  s.player.y = 4;
  s.items = [];
  s.enemies = [];
  s.landmark.resolved = true;
  return s;
};
const enemy = (id, x, y, hp = 5) => ({
  id,
  x,
  y,
  hp,
  maxHp: hp,
  kind: "husk",
  intent: [],
  stun: 0,
});
test("starting kits have distinct strengths and saves preserve them", () => {
  const c = newRun(1),
    r = newRun(1, "relay"),
    b = newRun(1, "breaker");
  assert.equal(c.kit, "courier");
  assert.ok(r.player.hp < c.player.hp);
  assert.ok(r.player.maxCharges > c.player.maxCharges);
  assert.ok(b.player.attack > c.player.attack);
  assert.ok(b.player.maxCharges < c.player.maxCharges);
  assert.deepEqual(c.tiles, r.tiles);
  assert.equal(Object.keys(KITS).length, 3);
  for (const s of [c, r, b]) assert.deepEqual(decodeSave(encodeSave(s)), s);
  assert.throws(() => newRun(1, "unknown"));
});
test("Relay refunds only pulse multi-kills; Breaker repairs only melee kills", () => {
  const r = arena("relay");
  r.enemies = [enemy(0, 5, 4), enemy(1, 4, 5)];
  const charges = r.player.charges;
  act(r, "pulse");
  assert.equal(r.kills, 2);
  assert.equal(r.player.charges, charges);
  const single = arena("relay");
  single.enemies = [enemy(0, 5, 4)];
  act(single, "pulse");
  assert.equal(single.player.charges, 2);
  const b = arena("breaker");
  b.player.hp = 10;
  b.enemies = [enemy(0, 5, 4, 4)];
  act(b, "right");
  assert.equal(b.player.hp, 11);
  b.enemies = [enemy(1, 4, 5, 3)];
  act(b, "pulse");
  assert.equal(b.player.hp, 11);
});
test("Aftershock and kinetic recovery create a melee/pulse loop and survive reload", () => {
  let s = arena();
  s.relics = ["aftershock", "kinetic"];
  s.enemies = [enemy(0, 5, 4, 15)];
  s.player.charges = 2;
  act(s, "pulse");
  assert.equal(s.enemies[0].hp, 11);
  s = decodeSave(encodeSave(s));
  act(s, "right");
  assert.equal(s.enemies[0].hp, 5);
  assert.equal(s.player.charges, 1);
  s = decodeSave(encodeSave(s));
  act(s, "right");
  assert.equal(s.enemies[0].hp, 2);
  assert.equal(s.player.charges, 2);
  assert.equal(s.meleeHits, 2);
  const turn = s.turn;
  act(s, "invalid");
  assert.equal(s.meleeHits, 2);
  assert.equal(s.turn, turn);
});
test("synergy upgrades are installable and legacy builds remain readable", () => {
  const s = arena();
  s.phase = "upgrade";
  s.choices = ["aftershock", "kinetic", "blade"];
  assert.ok(chooseUpgrade(s, "aftershock"));
  assert.ok(s.relics.includes("aftershock"));
  delete s.kit;
  delete s.meleeHits;
  delete s.id;
  assert.ok(decodeSave(encodeSave(s)));
  s.kit = "unknown";
  assert.equal(decodeSave(encodeSave(s)), null);
  s.kit = "courier";
  s.meleeHits = -1;
  assert.equal(decodeSave(encodeSave(s)), null);
});
