// Run after npm run build, with npm run dev serving the production bundle.
// Every featured run state is reached through the real simulation.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  newRun,
  act,
  chooseUpgrade,
  chooseEncounter,
  encodeSave,
} from "../src/game.js";
import { newProfile, trackRun, creditRun } from "../src/profile.js";
import route from "../tests/fixtures/expedition.json" with { type: "json" };

const base =
  process.env.FOGFALL_CAPTURE_URL ?? "http://127.0.0.1:4173/rogue-vision/";
const output = "media/screenshots";
await mkdir(output, { recursive: true });
const clone = (s) => structuredClone(s);
const expedition = newRun(route.seed, "courier", route.rules);
expedition.id = "media-expedition";
let tactics,
  upgrade,
  build,
  best = -1;
for (const action of route.actions) {
  if (action.startsWith("upgrade:")) chooseUpgrade(expedition, action.slice(8));
  else if (action.startsWith("encounter:"))
    chooseEncounter(expedition, action.slice(10));
  else act(expedition, action);
  if (expedition.phase === "upgrade" && !upgrade) upgrade = clone(expedition);
  if (expedition.phase === "playing") {
    const visible = expedition.enemies.filter(
      (e) => expedition.visible[e.y][e.x],
    );
    const warnings = visible
      .flatMap((e) => e.intent)
      .filter((p) => expedition.visible[p.y][p.x]).length;
    const score = warnings * 8 + visible.length * 3 + expedition.floor;
    if (warnings && score > best) {
      best = score;
      tactics = clone(expedition);
    }
    if (expedition.relics.length === 3 && !build) build = clone(expedition);
  }
}
expect(expedition).toMatchObject(route.expected);
if (!tactics || !upgrade || !build)
  throw Error("Replay lacks required feature scenes");

// Walk a genuine optional detour. Repeated bumps resolve hostile encounters.
function toward(s, goal) {
  const vectors = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] },
    queue = [{ ...s.player, first: null }],
    seen = new Set();
  for (const p of queue) {
    if (p.x === goal.x && p.y === goal.y) return p.first;
    for (const [action, [dx, dy]] of Object.entries(vectors)) {
      const x = p.x + dx,
        y = p.y + dy,
        k = `${x},${y}`;
      if (s.tiles[y]?.[x] !== 0 || seen.has(k)) continue;
      seen.add(k);
      queue.push({ x, y, first: p.first ?? action });
    }
  }
  return null;
}
let landmark;
for (let seed = 1; seed <= 50 && !landmark; seed++) {
  const s = newRun(seed);
  s.id = `media-landmark-${seed}`;
  for (let i = 0; i < 100 && s.phase === "playing"; i++) {
    const near = s.enemies.filter(
      (e) =>
        Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) <=
        s.player.pulseRange,
    );
    const action =
      s.player.charges && near.length >= 2 ? "pulse" : toward(s, s.landmark);
    if (!action) break;
    act(s, action);
  }
  if (s.phase === "encounter") landmark = s;
}
if (!landmark) throw Error("Unable to reach a landmark");

const browser = await chromium.launch(),
  manifest = {
    source: "Unmodified production UI; seeded simulation states",
    viewport: { width: 600, height: 600 },
    captures: [],
  };
async function capture(name, state, navigate) {
  const context = await browser.newContext({
    viewport: manifest.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  try {
    const profile = newProfile();
    trackRun(profile, state);
    creditRun(profile, state);
    await context.addInitScript(
      ({ save, profile }) => {
        localStorage.setItem("fogfall.run.v1", save);
        localStorage.setItem("fogfall.profile.v1", JSON.stringify(profile));
      },
      { save: encodeSave(state), profile },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
    await page.evaluate(() => document.fonts.ready);
    const press = async (key) => {
      await page.keyboard.press(key);
      await page.waitForTimeout(80);
    };
    const choose = async (action) => {
      for (
        let i = 0;
        i < 4 &&
        (await page.locator(":focus").getAttribute("data-action")) !== action;
        i++
      )
        await press("ArrowDown");
      await expect(page.locator(":focus")).toHaveAttribute(
        "data-action",
        action,
      );
      await press("Enter");
    };
    await navigate({ page, context, press, choose });
    if (errors.length) throw Error(errors.join("\n"));
    const bytes = await page.screenshot({ path: `${output}/${name}.png` });
    manifest.captures.push({
      file: `${name}.png`,
      seed: state.seed,
      turn: state.turn,
      floor: state.floor,
      phase: state.phase,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } finally {
    await context.close();
  }
}
try {
  await capture("tactical-combat", tactics, async ({ choose }) =>
    choose("resume"),
  );
  await capture("landmark-deal", landmark, async ({ choose }) =>
    choose("resume"),
  );
  await capture("district-upgrade", upgrade, async ({ choose }) =>
    choose("resume"),
  );
  await capture("starting-kits", expedition, async ({ choose }) =>
    choose("start"),
  );
  await capture("build-synergies", build, async ({ choose, press }) => {
    await choose("resume");
    await press("Enter");
    await choose("more");
    await choose("build");
  });
  await capture("offline-ready", build, async ({ choose, context, page }) => {
    await choose("kit");
    await choose("diagnostics");
    await context.setOffline(true);
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  });
  await writeFile(
    `${output}/captures.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(manifest);
} finally {
  await browser.close();
}
