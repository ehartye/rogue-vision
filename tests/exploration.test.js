import test from "node:test";
import assert from "node:assert/strict";
import { generateDistrict, distances } from "../src/districts.js";
import {
  newRun,
  act,
  chooseEncounter,
  decodeSave,
  encodeSave,
  LANDMARKS,
} from "../src/game.js";
function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test("every district is connected, breaks both perimeter shortcuts, and has a real landmark detour", () => {
  for (let floor = 0; floor < 4; floor++)
    for (let seed = 1; seed <= 150; seed++) {
      const mixedSeed = Math.imul(seed, 2654435761) >>> 0;
      const a = generateDistrict(floor, rng(mixedSeed)),
        fromStart = distances(a.tiles, { x: 1, y: 1 }),
        fromExit = distances(a.tiles, { x: 9, y: 9 });
      assert.deepEqual(a, generateDistrict(floor, rng(mixedSeed)));
      assert.equal(
        fromStart.size,
        a.tiles.flat().filter((t) => t === 0).length,
      );
      assert.ok(fromStart.has("9,9"));
      assert.ok(a.tiles[1].slice(2, 9).includes(1));
      assert.ok(a.tiles.slice(2, 9).some((row) => row[1] === 1));
      const k = `${a.landmark.x},${a.landmark.y}`;
      assert.ok(fromStart.get(k) + fromExit.get(k) - fromStart.get("9,9") >= 2);
      assert.equal(a.tiles[1][2], 0);
      assert.equal(a.tiles[2][2], 0);
      assert.equal(a.tiles[2][1], 0);
    }
  for (let floor = 1; floor < 4; floor++)
    assert.notDeepEqual(
      generateDistrict(0, rng(1)).tiles,
      generateDistrict(floor, rng(1)).tiles,
    );
});
function atLandmark(floor = 0) {
  const s = newRun(9);
  s.floor = floor;
  s.enemies = [];
  s.items = [];
  s.landmark = { x: 2, y: 1, resolved: false };
  s.player.x = 1;
  s.player.y = 1;
  act(s, "right");
  return s;
}
test("landmark choice freezes time and persists through reload", () => {
  const s = atLandmark();
  assert.equal(s.phase, "encounter");
  const turn = s.turn;
  act(s, "left");
  assert.equal(s.turn, turn);
  assert.deepEqual(decodeSave(encodeSave(s)), s);
  assert.equal(Object.keys(LANDMARKS).length, 4);
});
test("supplies have a stated cost, cannot be farmed, and passing costs nothing", () => {
  const s = atLandmark();
  s.player.hp = 8;
  const charges = s.player.charges;
  assert.ok(chooseEncounter(s, "take"));
  assert.equal(s.player.hp, 15);
  assert.equal(s.player.charges, charges - 1);
  assert.equal(s.phase, "playing");
  assert.equal(chooseEncounter(s, "take"), false);
  act(s, "left");
  act(s, "right");
  assert.equal(s.phase, "playing");
  assert.equal(s.player.charges, charges - 1);
  const leave = atLandmark(),
    before = structuredClone(leave.player),
    turn = leave.turn;
  chooseEncounter(leave, "leave");
  assert.deepEqual(leave.player, before);
  assert.equal(leave.turn, turn);
});
test("unaffordable choices do not trap or damage the player", () => {
  const s = atLandmark();
  s.player.charges = 0;
  assert.equal(chooseEncounter(s, "take"), false);
  assert.equal(s.phase, "encounter");
  assert.ok(chooseEncounter(s, "leave"));
  assert.equal(s.phase, "playing");
  const c = atLandmark(1);
  c.player.hp = 3;
  assert.equal(chooseEncounter(c, "take"), false);
  assert.equal(c.player.hp, 3);
});
test("landmark rewards differ and the cable car reinforcements spawn on distinct clear tiles", () => {
  const c = atLandmark(1);
  chooseEncounter(c, "take");
  assert.equal(c.player.hp, 15);
  assert.equal(c.player.charges, 3);
  const tram = atLandmark(2);
  chooseEncounter(tram, "take");
  assert.equal(tram.enemies.length, 2);
  assert.ok(
    tram.enemies.every(
      (e) =>
        e.kind === "runner" &&
        tram.tiles[e.y][e.x] === 0 &&
        Math.abs(e.x - tram.player.x) + Math.abs(e.y - tram.player.y) >= 3,
    ),
  );
  assert.equal(new Set(tram.enemies.map((e) => `${e.x},${e.y}`)).size, 2);
  const m = atLandmark(3);
  chooseEncounter(m, "take");
  assert.equal(m.player.attack, 4);
  assert.equal(m.player.charges, 0);
});
test("original saves still load; malformed landmark saves are rejected", () => {
  const s = newRun(10);
  delete s.landmark;
  assert.ok(decodeSave(encodeSave(s)));
  s.landmark = { x: 99, y: 2, resolved: false };
  assert.equal(decodeSave(encodeSave(s)), null);
});
