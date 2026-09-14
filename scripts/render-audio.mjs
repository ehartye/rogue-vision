import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Audition the native synthesis graph, without a dev server or microphone.
const output = resolve(".artifacts/audio");
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents:
      'export * from "./src/audio.js"; export * from "./src/score.js"; export * from "./src/audio-cues.js";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "iife",
  globalName: "preview",
});
const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const [floor, name] of [
    "Embarcadero",
    "Chinatown",
    "Market Street",
    "Moscone",
  ].entries()) {
    const rendered = await page.evaluate(async (floor) => {
      const sampleRate = 44100,
        duration = preview.BAR_SECONDS * 8 + 3;
      const ctx = new OfflineAudioContext(
        1,
        Math.ceil(sampleRate * duration),
        sampleRate,
      );
      const master = ctx.createGain(),
        music = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      music.gain.value = 0.65;
      music.connect(master);
      for (let bar = 0; bar < 8; bar++)
        preview.schedulePatch(
          ctx,
          music,
          preview.composeBar(
            { seed: 123, floor, pressure: bar < 4 ? 0 : 2 },
            bar,
          ),
          bar * preview.BAR_SECONDS,
        );
      for (const [id, when] of [
        ["damage", 8],
        ["warning", 14],
        ["kill", 20],
        ["won", preview.BAR_SECONDS * 8],
      ]) {
        const patch = preview.PATCHES[id];
        preview.schedulePatch(ctx, master, patch, when);
        preview.duckMusic(
          music.gain,
          when,
          Math.max(...patch.map((n) => n.at + n.duration)),
        );
      }
      const samples = (await ctx.startRendering()).getChannelData(0);
      const pcm = new Uint8Array(samples.length * 2),
        view = new DataView(pcm.buffer);
      let peak = 0,
        energy = 0;
      for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        if (!Number.isFinite(value)) throw Error("Nonfinite audio");
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
        view.setInt16(
          i * 2,
          Math.round(Math.max(-1, Math.min(1, value)) * 32767),
          true,
        );
      }
      let binary = "";
      for (let i = 0; i < pcm.length; i += 16384)
        binary += String.fromCharCode(...pcm.subarray(i, i + 16384));
      return {
        pcm: btoa(binary),
        sampleRate,
        peak,
        rms: Math.sqrt(energy / samples.length),
        seconds: duration,
      };
    }, floor);
    if (rendered.peak >= 1 || rendered.rms < 0.0001)
      throw Error("Invalid audio levels");
    const pcm = Buffer.from(rendered.pcm, "base64"),
      header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVEfmt ", 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(rendered.sampleRate, 24);
    header.writeUInt32LE(rendered.sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);
    const file = `${floor + 1}-${name.toLowerCase().replaceAll(" ", "-")}.wav`;
    await writeFile(resolve(output, file), Buffer.concat([header, pcm]));
    rows.push({
      name,
      file,
      peak: rendered.peak,
      rms: rendered.rms,
      seconds: rendered.seconds,
    });
  }
} finally {
  await browser.close();
}
await writeFile(
  resolve(output, "measurements.json"),
  JSON.stringify(rows, null, 2) + "\n",
);
await writeFile(
  resolve(output, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>FOGFALL audio audition</title><style>body{background:#101619;color:#e3f7fc;font:18px system-ui;max-width:720px;margin:48px auto;padding:24px}audio{width:100%}p{line-height:1.6}</style><h1>FOGFALL · Lost signal</h1><p>Each district starts quietly, adds danger in its second phrase, and ends with the restored signal. Action cues occur at 8, 14 and 20 seconds. These native browser renders use the game's mix levels; headphones and glasses will sound different.</p>${rows.map((r) => `<h2>${r.name}</h2><audio controls preload="none" src="${r.file}"></audio>`).join("")}`,
);
console.log(JSON.stringify({ output, rows }, null, 2));
