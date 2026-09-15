import test from "node:test";
import assert from "node:assert/strict";
const fx = await import("../src/combat-effects.js").catch(() => ({}));
function harness() {
  assert.equal(typeof fx.createCombatEffects, "function");
  let time = 0, hidden = false, reduced = false, draws = 0, next = 0;
  const frames = new Map();
  const effects = fx.createCombatEffects({
    redraw: () => draws++, now: () => time, isHidden: () => hidden,
    reducedMotion: () => reduced,
    requestFrame: fn => { frames.set(++next, fn); return next; },
    cancelFrame: id => frames.delete(id),
  });
  return { effects, frames, get draws() { return draws; },
    reduced: () => { reduced = true; }, hide: () => { hidden = true; },
    tick(ms) { time += ms; const queued = [...frames.values()]; frames.clear(); queued.forEach(fn => fn()); },
  };
}
const hit = { kind: "melee", to: { x: 3, y: 3 }, from: { x: 2, y: 3 }, amount: 3, visible: true };
test("effects expire without advancing gameplay and never queue old actions", () => {
  const h = harness();
  h.effects.play([hit]);
  assert.equal(h.effects.snapshot().events.length, 1);
  h.tick(100);
  h.effects.play([{ ...hit, amount: 1 }]);
  assert.equal(h.effects.snapshot().events[0].amount, 1);
  assert.equal(h.frames.size, 1);
  h.tick(700);
  assert.equal(h.effects.snapshot(), null);
  assert.equal(h.frames.size, 0);
  assert.ok(h.draws >= 3);
});
test("private records are dropped and menu/background cancellation cannot resurrect effects", () => {
  const h = harness();
  h.effects.play([{ ...hit, visible: false }]);
  assert.equal(h.effects.snapshot(), null);
  assert.equal(h.frames.size, 0);
  h.effects.play([hit]);
  const stale = [...h.frames.values()][0];
  h.effects.clear(); stale();
  assert.equal(h.frames.size, 0);
  h.effects.play([hit]); h.hide(); h.tick(20);
  assert.equal(h.effects.snapshot(), null);
  assert.equal(h.frames.size, 0);
});
test("reduced motion is captured and input records cannot change an active effect", () => {
  const h = harness(); h.reduced();
  const event = structuredClone(hit); h.effects.play([event]); event.amount = 99;
  assert.equal(h.effects.snapshot().events[0].amount, 3);
  assert.equal(h.effects.snapshot().reduced, true);
});
