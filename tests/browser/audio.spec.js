import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { newRun, encodeSave } from "../../src/game.js";

async function harness(page) {
  await page.goto("./");
  if (!existsSync("src/audio.js")) {
    await page.evaluate(() => (window.audioTest = {}));
    return;
  }
  const bundle = await build({
    stdin: {
      contents:
        'export * from "./src/audio.js"; export * from "./src/audio-cues.js";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "audioTest",
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
}

test("each authored cue renders finite audible output with a clean release", async ({
  page,
}) => {
  await harness(page);
  expect(await page.evaluate(() => typeof window.audioTest.schedulePatch)).toBe(
    "function",
  );
  const results = await page.evaluate(async () => {
    const rows = [];
    for (const [id, patch] of Object.entries(audioTest.PATCHES)) {
      const ctx = new OfflineAudioContext(1, 24000 * 3, 24000);
      audioTest.schedulePatch(ctx, ctx.destination, patch, 0.05);
      const data = (await ctx.startRendering()).getChannelData(0);
      const energy = data.reduce((sum, x) => sum + x * x, 0);
      rows.push({
        id,
        finite: data.every(Number.isFinite),
        peak: Math.max(...data.map(Math.abs)),
        rms: Math.sqrt(energy / data.length),
        tail: Math.max(...data.slice(-1000).map(Math.abs)),
      });
    }
    return rows;
  });
  for (const row of results) {
    expect(row.finite, row.id).toBe(true);
    expect(row.rms, row.id).toBeGreaterThan(0.0003);
    expect(row.peak, row.id).toBeLessThan(0.2);
    expect(row.tail, row.id).toBe(0);
  }
});

test("mute and backgrounding discard a pending resume instead of replaying stale cues", async ({
  page,
}) => {
  await harness(page);
  expect(await page.evaluate(() => typeof window.audioTest.createAudio)).toBe(
    "function",
  );
  const result = await page.evaluate(async () => {
    const ctx = new AudioContext();
    await ctx.suspend();
    let finish,
      starts = 0;
    const realCreate = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = () => {
      starts++;
      return realCreate();
    };
    const realResume = ctx.resume.bind(ctx);
    ctx.resume = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const audio = audioTest.createAudio({
      createContext: () => ctx,
      isHidden: () => false,
    });
    audio.setEnabled(true);
    const pending = audio.play(["won"]);
    audio.setEnabled(false);
    await realResume();
    finish();
    await pending;
    const afterMute = starts;
    await ctx.suspend();
    audio.setEnabled(true);
    const pendingHidden = audio.play(["damage"]);
    audio.suspend();
    await realResume();
    finish();
    await pendingHidden;
    await ctx.close();
    return { afterMute, afterHidden: starts };
  });
  expect(result).toEqual({ afterMute: 0, afterHidden: 0 });
});

test("menu focus cannot truncate a milestone resolution", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const ctx = new AudioContext();
    await ctx.resume();
    let starts = 0,
      stops = 0;
    const create = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = () => {
      starts++;
      const oscillator = create(),
        stop = oscillator.stop.bind(oscillator);
      oscillator.stop = (at) => {
        stops++;
        return stop(at);
      };
      return oscillator;
    };
    const audio = audioTest.createAudio({
      createContext: () => ctx,
      isHidden: () => false,
    });
    audio.setEnabled(true);
    await audio.play(["won"]);
    await audio.play(["focus"]);
    const result = { starts, stops };
    audio.setEnabled(false);
    await ctx.close();
    return result;
  });
  expect(result).toEqual({ starts: 6, stops: 6 });
});

test("sound is lazy, persists its preference, and disabling it cancels active voices", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.contexts = [];
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        window.contexts.push(this);
      }
    };
  });
  await page.goto("./");
  expect(await page.evaluate(() => window.contexts.length)).toBe(0);
  await page.getByRole("button", { name: "Field kit" }).click();
  await page.getByRole("button", { name: "Sound: off" }).click();
  await expect
    .poll(() => page.evaluate(() => window.contexts[0]?.state))
    .toBe("running");
  expect(await page.evaluate(() => localStorage.getItem("fogfall.sound"))).toBe(
    "on",
  );
  await page.getByRole("button", { name: "Sound: on" }).click();
  await expect
    .poll(() => page.evaluate(() => window.contexts[0]?.state))
    .toBe("suspended");
  await page.reload();
  await page.getByRole("button", { name: "Field kit" }).click();
  await expect(page.getByRole("button", { name: "Sound: off" })).toBeVisible();
});

test("unavailable audio never prevents enabling sound or starting a run", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Field kit" }).click();
  await page.getByRole("button", { name: "Sound: off" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Enter the fog" }).click();
  await page.getByRole("button", { name: /Courier/ }).click();
  await expect(page.locator('[data-screen="mission"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("the real final-uplink action plays the resolving cadence", async ({
  page,
}) => {
  const run = newRun(123);
  run.floor = 3;
  run.enemies = [];
  run.items = [];
  delete run.landmark;
  Object.assign(run.player, { x: 8, y: 9 });
  run.tiles[9][8] = 0;
  run.tiles[9][9] = 0;
  await page.addInitScript((save) => {
    localStorage.setItem("fogfall.run.v1", save);
    localStorage.setItem("fogfall.sound", "on");
    const Native = window.AudioContext;
    window.scheduledNotes = [];
    window.AudioContext = class extends Native {
      createOscillator() {
        const oscillator = super.createOscillator();
        const set = oscillator.frequency.setValueAtTime.bind(
          oscillator.frequency,
        );
        oscillator.frequency.setValueAtTime = (value, at) => {
          window.scheduledNotes.push(value);
          return set(value, at);
        };
        return oscillator;
      }
    };
  }, encodeSave(run));
  await page.goto("./");
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await page.evaluate(() => {
    window.scheduledNotes = [];
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-screen="won"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.scheduledNotes.length))
    .toBe(6);
  const notes = await page.evaluate(() => window.scheduledNotes);
  expect(notes.at(-1)).toBeCloseTo(440 * 2 ** ((86 - 69) / 12), 4);
});
