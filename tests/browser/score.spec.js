import { test, expect } from "@playwright/test";
import { build } from "esbuild";

async function harness(page) {
  await page.goto("./");
  const bundle = await build({
    stdin: {
      contents:
        'export * from "./src/audio.js"; export * from "./src/score.js"; export * from "./src/audio-cues.js";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "scoreTest",
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
}
test("four district arrangements render with headroom and silence at phrase ends", async ({
  page,
}) => {
  await harness(page);
  const rows = await page.evaluate(async () => {
    const rows = [];
    for (let floor = 0; floor < 4; floor++) {
      const seconds = scoreTest.BAR_SECONDS * 4;
      const ctx = new OfflineAudioContext(1, Math.ceil(seconds * 24000), 24000);
      for (let bar = 0; bar < 4; bar++)
        scoreTest.schedulePatch(
          ctx,
          ctx.destination,
          scoreTest.composeBar({ seed: 31, floor, pressure: 2 }, bar),
          bar * scoreTest.BAR_SECONDS,
        );
      const data = (await ctx.startRendering()).getChannelData(0);
      rows.push({
        floor,
        peak: data.reduce((m, x) => Math.max(m, Math.abs(x)), 0),
        rms: Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length),
        finite: data.every(Number.isFinite),
        tail: data.slice(-12000).every((x) => x === 0),
      });
    }
    return rows;
  });
  for (const row of rows) {
    expect(row.finite).toBe(true);
    expect(row.peak).toBeLessThan(0.12);
    expect(row.rms).toBeGreaterThan(0.002);
    expect(row.tail).toBe(true);
  }
});
test("music stops in menus and hidden state, then resumes without replaying missed notes", async ({
  page,
}) => {
  await harness(page);
  expect(
    await page.evaluate(() => typeof scoreTest.createAudio().setScene),
  ).toBe("function");
  const result = await page.evaluate(async () => {
    const ctx = new AudioContext();
    await ctx.resume();
    const native = ctx.createOscillator.bind(ctx);
    let starts = 0,
      stops = 0,
      hidden = false;
    ctx.createOscillator = () => {
      starts++;
      const o = native(),
        stop = o.stop.bind(o);
      o.stop = (at) => {
        stops++;
        return stop(at);
      };
      return o;
    };
    const audio = scoreTest.createAudio({
      createContext: () => ctx,
      isHidden: () => hidden,
    });
    audio.setEnabled(true);
    await audio.setScene({ seed: 1, floor: 0, pressure: 0 });
    const playing = starts;
    await audio.setScene(null);
    const stopped = stops;
    await new Promise((r) => setTimeout(r, 550));
    const menuStarts = starts;
    await audio.setScene({ seed: 1, floor: 0, pressure: 0 });
    hidden = true;
    audio.suspend();
    const hiddenStarts = starts;
    await new Promise((r) => setTimeout(r, 550));
    const afterHidden = starts;
    hidden = false;
    await audio.resume();
    const resumed = starts - hiddenStarts;
    audio.setEnabled(false);
    await ctx.close();
    return { playing, stopped, menuStarts, hiddenStarts, afterHidden, resumed };
  });
  expect(result.playing).toBeGreaterThan(0);
  expect(result.stopped).toBeGreaterThan(result.playing);
  expect(result.menuStarts).toBe(result.playing);
  expect(result.afterHidden).toBe(result.hiddenStarts);
  expect(result.resumed).toBeGreaterThan(0);
  expect(result.resumed).toBeLessThanOrEqual(3);
});
test("actual app starts music only in streets and leaves turn count unchanged while listening", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("fogfall.sound", "on");
    const Native = window.AudioContext;
    window.voiceStarts = 0;
    window.AudioContext = class extends Native {
      createOscillator() {
        window.voiceStarts++;
        return super.createOscillator();
      }
    };
  });
  await page.goto("./");
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  expect(await page.evaluate(() => window.voiceStarts)).toBe(0);
  await page.getByRole("button", { name: "Enter the fog" }).click();
  await page.getByRole("button", { name: /Courier/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.voiceStarts))
    .toBeGreaterThan(3);
  const turn = await page.locator("[data-turn]").textContent();
  await page.waitForTimeout(1400);
  await expect(page.locator("[data-turn]")).toHaveText(turn);
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-screen="actions"]')).toBeVisible();
  const before = await page.evaluate(() => window.voiceStarts);
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.voiceStarts)).toBe(before);
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => window.voiceStarts)).toBe(0);
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect
    .poll(() => page.evaluate(() => window.voiceStarts))
    .toBeGreaterThan(0);
  await expect(page.locator("[data-turn]")).toHaveText(turn);
});

test("the music bus audibly reduces its rendered level under an action cue", async ({
  page,
}) => {
  await harness(page);
  expect(await page.evaluate(() => typeof scoreTest.duckMusic)).toBe(
    "function",
  );
  const levels = await page.evaluate(async () => {
    const ctx = new OfflineAudioContext(1, 24000 * 2, 24000),
      source = ctx.createOscillator(),
      bus = ctx.createGain();
    bus.gain.value = 0.65;
    source.frequency.value = 440;
    source.connect(bus);
    bus.connect(ctx.destination);
    source.start(0);
    source.stop(2);
    scoreTest.duckMusic(bus.gain, 0.5, 0.5);
    const data = (await ctx.startRendering()).getChannelData(0);
    const rms = (from, to) =>
      Math.sqrt(
        data.slice(from * 24000, to * 24000).reduce((s, x) => s + x * x, 0) /
          ((to - from) * 24000),
      );
    return {
      before: rms(0.1, 0.4),
      during: rms(0.6, 0.9),
      after: rms(1.7, 1.9),
    };
  });
  expect(levels.during).toBeLessThan(levels.before * 0.4);
  expect(levels.after).toBeGreaterThan(levels.before * 0.95);
});

test("a delayed music resume cannot resurrect an old scene", async ({
  page,
}) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const ctx = new AudioContext();
    await ctx.suspend();
    const nativeResume = ctx.resume.bind(ctx),
      create = ctx.createOscillator.bind(ctx);
    const notes = [],
      pending = [];
    ctx.resume = () => new Promise((resolve) => pending.push(resolve));
    ctx.createOscillator = () => {
      const o = create(),
        set = o.frequency.setValueAtTime.bind(o.frequency);
      o.frequency.setValueAtTime = (frequency, at) => {
        notes.push(frequency);
        return set(frequency, at);
      };
      return o;
    };
    const audio = scoreTest.createAudio({
      createContext: () => ctx,
      isHidden: () => false,
    });
    audio.setEnabled(true);
    const old = audio.setScene({ seed: 1, floor: 0, pressure: 0 });
    await audio.setScene(null);
    await nativeResume();
    pending.splice(0).forEach((resolve) => resolve());
    await old;
    const menuNotes = notes.length;
    await ctx.suspend();
    const first = audio.setScene({ seed: 1, floor: 0, pressure: 0 });
    const current = audio.setScene({ seed: 1, floor: 1, pressure: 0 });
    await nativeResume();
    pending.splice(0).forEach((resolve) => resolve());
    await Promise.all([first, current]);
    const currentNotes = [...notes];
    audio.setEnabled(false);
    await ctx.close();
    return { menuNotes, currentNotes };
  });
  expect(result.menuNotes).toBe(0);
  expect(result.currentNotes).toHaveLength(3);
  expect(result.currentNotes.at(-1)).toBeCloseTo(
    440 * 2 ** ((74 - 69) / 12),
    4,
  );
});
