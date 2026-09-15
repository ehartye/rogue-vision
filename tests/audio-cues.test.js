import test from "node:test";
import assert from "node:assert/strict";
const cues = await import("../src/audio-cues.js").catch(() => ({}));
test("fatal and milestone cues replace ordinary action chatter", () => {
  assert.equal(typeof cues.selectCues, "function");
  assert.deepEqual(cues.selectCues(["wait", "damage", "dead", "kill"]), [
    "dead",
  ]);
  assert.deepEqual(cues.selectCues(["move", "pickup", "won"]), ["won"]);
  assert.deepEqual(cues.selectCues(["move", "uplink"]), ["uplink"]);
});
test("cue arbitration keeps danger first and at most three distinct outcomes", () => {
  assert.equal(typeof cues.selectCues, "function");
  assert.deepEqual(cues.selectCues(["hit", "kill", "damage"]), [
    "damage",
    "kill",
  ]);
  assert.deepEqual(
    cues.selectCues(["pulse", "kill", "kill", "damage", "warning", "pickup"]),
    ["damage", "warning", "pulse"],
  );
  assert.deepEqual(cues.selectCues(["wait", "warning"]), ["warning"]);
  assert.deepEqual(cues.selectCues(["unknown"]), []);
  assert.deepEqual(
    cues.selectCues(["shot", "blast", "pickup", "damage", "warning", "pulse"]),
    ["damage", "warning", "pulse"],
  );
  assert.deepEqual(cues.selectCues(["shot", "shot", "blast", "pickup"]), [
    "blast",
    "shot",
    "pickup",
  ]);
});
test("all semantic outcomes have bounded patches and danger has midrange content", () => {
  assert.ok(cues.PATCHES);
  for (const id of [
    "move",
    "wait",
    "hit",
    "pulse",
    "kill",
    "damage",
    "warning",
    "blocked",
    "dead",
    "pickup",
    "landmark",
    "trade",
    "leave",
    "arrival",
    "uplink",
    "won",
    "focus",
    "shot",
    "blast",
  ]) {
    const patch = cues.PATCHES[id];
    assert.ok(patch?.length, id);
    assert.ok(patch.length <= 8);
    for (const note of patch) {
      if (note.type === "noise") {
        assert.equal(note.filter, "bandpass");
        assert.ok(note.frequency >= 200 && note.frequency <= 6000);
        assert.ok(note.endFrequency >= 200 && note.endFrequency <= 6000);
      } else {
        assert.ok(note.midi >= 48 && note.midi <= 90);
        assert.ok(note.end >= 48 && note.end <= 90);
      }
      assert.ok(note.duration > 0 && note.duration <= 1.5);
      assert.ok(note.gain > 0 && note.gain <= 0.1);
    }
  }
  assert.ok(cues.PATCHES.dead.some((n) => n.midi >= 60));
  assert.ok(cues.PATCHES.damage.some((n) => n.midi >= 60));
  assert.deepEqual(
    cues.PATCHES.won.slice(0, 3).map((n) => n.midi),
    cues.SIGNAL,
  );
  assert.equal(cues.PATCHES.won.at(-1).midi % 12, 2, "victory resolves to D");
});

test("battle cues combine a short impact texture with a pitched body", () => {
  for (const id of ["hit", "damage", "kill", "pulse", "shot", "blast"]) {
    const patch = cues.PATCHES[id];
    assert.ok(
      patch?.some((n) => n.type === "noise"),
      `${id}: impact texture`,
    );
    assert.ok(
      patch.some((n) => n.type !== "noise" && n.end < n.midi),
      `${id}: pitch drop`,
    );
    assert.ok(Math.max(...patch.map((n) => n.at + n.duration)) <= 0.5, id);
  }
});
