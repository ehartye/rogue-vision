import test from "node:test";
import assert from "node:assert/strict";
import {
  newProfile,
  readProfile,
  trackRun,
  creditRun,
  kitUnlocked,
  unlockProgress,
  resumeRun,
  acknowledgeRun,
} from "../src/profile.js";
import { newRun } from "../src/game.js";

test("repeated failed new-run writes retain the last durable receipt until acknowledgement", () => {
  let p = newProfile();
  const a = newRun(1);
  a.id = "A";
  a.kills = 3;
  trackRun(p, a);
  creditRun(p, a);
  acknowledgeRun(p, a);
  const b = newRun(2);
  b.id = "B";
  trackRun(p, b);
  creditRun(p, b);
  const c = newRun(3);
  c.id = "C";
  trackRun(p, c);
  creditRun(p, c);
  // Both new SAVE writes failed; only their profile writes reached disk.
  p = readProfile(JSON.stringify(p)).profile;
  assert.equal(p.previous.id, "A");
  assert.ok(resumeRun(p, a));
  a.kills++;
  creditRun(p, a);
  assert.equal(p.kills, 4);
  acknowledgeRun(p, a);
  trackRun(p, b);
  acknowledgeRun(p, b);
  trackRun(p, c);
  assert.equal(p.previous.id, "B");
  p = readProfile(JSON.stringify(p)).profile;
  assert.ok(resumeRun(p, c));
  assert.equal(p.previous, null);
});

test("unlock thresholds are cumulative across losses and awards are idempotent", () => {
  const p = newProfile(),
    a = newRun(1);
  a.id = "first";
  trackRun(p, a);
  a.kills = 9;
  a.floor = 1;
  a.phase = "dead";
  creditRun(p, a);
  assert.equal(kitUnlocked(p, "relay"), false);
  assert.equal(kitUnlocked(p, "breaker"), false);
  const snapshot = structuredClone(p);
  creditRun(p, a);
  assert.deepEqual(p, snapshot);
  const b = newRun(2);
  b.id = "second";
  trackRun(p, b);
  b.kills = 1;
  b.floor = 1;
  b.phase = "upgrade";
  creditRun(p, b);
  assert.equal(p.runs, 2);
  assert.equal(p.kills, 10);
  assert.equal(p.districts, 3);
  assert.ok(kitUnlocked(p, "relay"));
  assert.ok(kitUnlocked(p, "breaker"));
  assert.equal(kitUnlocked(p, "invalid"), false);
  assert.equal(unlockProgress(newProfile(), "relay"), "0/10 kills");
  assert.equal(creditRun(p, a), false);
});
test("reload and interrupted writes never count replayed turns or victories twice", () => {
  let p = newProfile();
  const r = newRun(4);
  r.id = "stable";
  trackRun(p, r);
  r.kills = 8;
  r.score = 800;
  r.phase = "won";
  r.floor = 3;
  creditRun(p, r);
  p = readProfile(JSON.stringify(p)).profile;
  creditRun(p, r);
  trackRun(p, r);
  assert.equal(p.wins, 1);
  assert.equal(p.runs, 1);
  assert.equal(p.districts, 4);
  assert.equal(p.best, 800);
  r.kills = 5;
  r.floor = 2;
  r.phase = "playing";
  creditRun(p, r);
  r.kills = 8;
  r.floor = 3;
  r.phase = "won";
  creditRun(p, r);
  assert.equal(p.kills, 8);
  assert.equal(p.wins, 1);
  assert.equal(p.districts, 4);
});
test("legacy stats migrate, a resumed legacy run is not counted as a fresh start, and corrupt profiles recover visibly", () => {
  const old = { runs: 8, wins: 2, best: 910 };
  let loaded = readProfile(null, old);
  assert.equal(loaded.recovered, false);
  assert.equal(loaded.profile.runs, 8);
  const r = newRun(7);
  r.id = "legacy";
  r.kills = 4;
  trackRun(loaded.profile, r, false);
  creditRun(loaded.profile, r);
  assert.equal(loaded.profile.runs, 8);
  assert.equal(loaded.profile.kills, 4);
  loaded = readProfile("{broken", old);
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.profile.wins, 2);
  for (const mutate of [
    (p) => (p.version = 99),
    (p) => (p.kills = -1),
    (p) => (p.current = { id: "x" }),
    (p) => (p.runs = Infinity),
  ]) {
    const p = newProfile();
    mutate(p);
    assert.equal(readProfile(JSON.stringify(p)).recovered, true);
  }
});
