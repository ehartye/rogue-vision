import test from "node:test";
import assert from "node:assert/strict";
const transport = await import("../src/score-transport.js").catch(() => ({}));
function rig() {
  assert.equal(typeof transport.createTransport, "function");
  const context = { currentTime: 0, state: "running" },
    calls = [];
  let tick,
    starts = 0,
    stops = 0,
    cancelled = 0;
  const player = transport.createTransport({
    context,
    schedule: (notes, when) => {
      calls.push({ notes, when });
      return { stop: () => cancelled++ };
    },
    setTimer: (fn) => {
      tick = fn;
      starts++;
      return starts;
    },
    clearTimer: () => stops++,
  });
  return {
    context,
    calls,
    player,
    tick: () => tick(),
    counts: () => ({ starts, stops, cancelled }),
  };
}
const scene = { seed: 123, floor: 0, pressure: 0 };
test("transport uses a bounded audio-clock horizon and does not restart on every turn", () => {
  const r = rig();
  r.player.update(scene);
  assert.equal(r.counts().starts, 1);
  assert.ok(r.calls.length);
  assert.ok(r.calls.every((c) => c.when >= 0 && c.when <= 0.1));
  r.player.update({ ...scene, pressure: 2 });
  assert.equal(r.counts().starts, 1);
  for (let i = 0; i < 40; i++) {
    r.context.currentTime = i / 20;
    r.tick();
  }
  assert.ok(r.calls.every((c) => c.notes.every((n) => n.at === 0)));
  assert.ok(r.calls.some((c) => c.notes.some((n) => n.role === "pulse")));
});
test("long stalls skip missed slots instead of dumping a catch-up burst", () => {
  const r = rig();
  r.player.update(scene);
  r.calls.length = 0;
  r.context.currentTime = 1000;
  r.tick();
  assert.ok(r.calls.length <= 1);
  assert.ok(r.calls.every((c) => c.when >= 1000 && c.when <= 1000.1));
});
test("stop cancels voices, resume starts fresh, and district changes replace the arrangement", () => {
  const r = rig();
  r.player.update(scene);
  r.player.stop();
  assert.equal(r.counts().stops, 1);
  assert.ok(r.counts().cancelled > 0);
  r.context.currentTime = 20;
  r.calls.length = 0;
  r.player.update(scene);
  assert.equal(r.counts().starts, 2);
  assert.ok(r.calls[0].when >= 20);
  r.player.update({ ...scene, floor: 1 });
  assert.equal(r.counts().starts, 3);
  assert.ok(
    r.calls.at(-1).notes.some((n) => n.role === "signal" && n.midi === 74),
  );
  r.player.update(null);
  assert.equal(r.counts().stops, 3);
});
test("an interrupted context stops the clock and scheduler errors stay isolated", () => {
  const r = rig();
  r.player.update(scene);
  r.context.state = "interrupted";
  r.tick();
  assert.equal(r.counts().stops, 1);
  let clears = 0;
  const player = transport.createTransport({
    context: { state: "running", currentTime: 0 },
    schedule: () => {
      throw Error("device");
    },
    setTimer: () => 1,
    clearTimer: () => clears++,
  });
  assert.doesNotThrow(() => player.update(scene));
  assert.equal(clears, 1);
});
