import test from "node:test";
import assert from "node:assert/strict";
import { newRun, encodeSave } from "../src/game.js";
import { SIGNAL } from "../src/audio-cues.js";
const score = await import("../src/score.js").catch(() => ({}));

test("musical pressure depends on tactical state, never turns or elapsed time", () => {
  assert.equal(typeof score.musicState, "function");
  const run = newRun(37);
  run.enemies = [];
  const quiet = score.musicState(run);
  assert.equal(quiet.pressure, 0);
  run.turn += 1000;
  run.rng = 999;
  assert.deepEqual(score.musicState(run), quiet);
  run.player.hp = 1;
  assert.ok(score.musicState(run).pressure > quiet.pressure);
  run.phase = "won";
  assert.equal(score.musicState(run), null);
});
test("authored score is deterministic, varies between runs, and never mutates the world", () => {
  assert.equal(typeof score.composeBar, "function");
  const run = newRun(34),
    before = encodeSave(run),
    state = score.musicState(run);
  const a = Array.from({ length: 16 }, (_, bar) =>
    score.composeBar(state, bar),
  );
  assert.deepEqual(
    a,
    Array.from({ length: 16 }, (_, bar) => score.composeBar(state, bar)),
  );
  assert.notDeepEqual(
    a,
    Array.from({ length: 16 }, (_, bar) =>
      score.composeBar({ ...state, seed: 35 }, bar),
    ),
  );
  assert.equal(encodeSave(run), before);
});
test("all four arrangements preserve the signal identity, fixed tempo and phrase rests", () => {
  assert.equal(typeof score.composeBar, "function");
  const arrangements = [];
  for (let floor = 0; floor < 4; floor++) {
    const state = { seed: 123, floor, pressure: 0 };
    const bars = Array.from({ length: 4 }, (_, bar) =>
      score.composeBar(state, bar),
    );
    assert.deepEqual(
      bars[0].filter((n) => n.role === "signal").map((n) => n.midi % 12),
      SIGNAL.map((n) => n % 12),
    );
    assert.equal(bars[3].filter((n) => n.role === "signal").length, 0);
    assert.ok(
      bars[3].every((n) => n.at + n.duration < score.BAR_SECONDS - 0.25),
      "room to breathe at phrase end",
    );
    arrangements.push(bars);
  }
  assert.equal(new Set(arrangements.map(JSON.stringify)).size, 4);
  assert.equal(score.BPM, 72);
});
test("busy score stays bounded with audible registers and scheduled rests", () => {
  assert.equal(typeof score.composeBar, "function");
  for (let floor = 0; floor < 4; floor++)
    for (let bar = 0; bar < 48; bar++)
      for (let pressure = 0; pressure < 3; pressure++) {
        const notes = score.composeBar(
          { seed: 0xffffffff, floor, pressure },
          bar,
        );
        assert.ok(notes.length <= 9);
        for (const note of notes) {
          assert.ok(note.midi >= 50 && note.midi <= 86);
          assert.ok(note.duration >= 0.06 && note.duration <= 2);
          assert.ok(note.at >= 0 && note.at < score.BAR_SECONDS);
          assert.ok(note.gain <= 0.025);
          assert.ok(
            Math.abs(
              note.at / score.SLOT_SECONDS -
                Math.round(note.at / score.SLOT_SECONDS),
            ) < 1e-8,
          );
        }
      }
});
