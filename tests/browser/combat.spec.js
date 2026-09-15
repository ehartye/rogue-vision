import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { newRun, reveal, encodeSave } from "../../src/game.js";

function arena() {
  const s = newRun(123);
  s.tiles = Array.from({ length: 11 }, (_, y) => Array.from({ length: 11 }, (_, x) => +(x === 0 || y === 0 || x === 10 || y === 10)));
  Object.assign(s.player, { x: 5, y: 5 });
  s.items = [];
  delete s.landmark;
  s.enemies = [
    { id: 1, x: 6, y: 5, hp: 6, maxHp: 6, kind: "husk", intent: [], stun: 0 },
    { id: 2, x: 3, y: 5, hp: 5, maxHp: 5, kind: "spitter", intent: [{ x: 5, y: 5 }], stun: 0 },
  ];
  reveal(s);
  return s;
}
async function open(page, s) {
  await page.addInitScript(save => {
    if (!localStorage.getItem("fogfall.run.v1")) localStorage.setItem("fogfall.run.v1", save);
    window.damageText = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (String(text).startsWith("−")) window.damageText.push(text);
      return fill.call(this, text, ...args);
    };
  }, encodeSave(s));
  await page.goto("./");
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
}
const press = async (page, key) => { await page.keyboard.press(key); await page.waitForTimeout(90); };

test("full health bars, actual damage numbers and shots remain below future warnings without holding input", async ({ page }) => {
  await open(page, arena());
  const full = await page.locator(".map").evaluate(c => Array.from(c.getContext("2d").getImageData(6 * 36 + 10, 5 * 36 + 32, 1, 1).data));
  expect(full).toEqual([167, 197, 185, 255]);
  await press(page, "ArrowRight");
  await expect(page.locator(".map")).toHaveAttribute("data-effects", /melee.*shot.*damage/);
  const drawn = await page.evaluate(() => window.damageText);
  expect(drawn).toEqual(expect.arrayContaining(["−3", "−5"]));
  const warning = await page.locator(".map").evaluate(c => Array.from(c.getContext("2d").getImageData(5 * 36 + 2, 5 * 36 + 18, 1, 1).data));
  expect(warning).toEqual([255, 130, 125, 255]);
  await press(page, "Enter");
  await expect(page.locator('[data-action="pulse"]')).toBeFocused();
  await expect(page.locator(".map")).toHaveAttribute("data-effects", "");
  await expect(page.locator("[data-turn]")).toHaveText("1");
});

test("pulse animates from side actions and a mid-effect offline reload restores only the resolved turn", async ({ page, context }) => {
  await open(page, arena());
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  await press(page, "Enter"); await press(page, "Enter");
  await expect(page.locator(".map")).toHaveAttribute("data-effects", /pulse.*impact/);
  const save = await page.evaluate(() => localStorage.getItem("fogfall.run.v1"));
  await context.setOffline(true); await page.reload();
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-effects", "");
  await expect(page.locator("[data-turn]")).toHaveText("1");
  expect(await page.evaluate(() => localStorage.getItem("fogfall.run.v1"))).toBe(save);
});

test("effects clip fog, keep warnings and health readable, and reduced motion keeps numbers still", async ({ page }) => {
  await page.goto("./");
  const bundle = await build({ stdin: { contents: 'export {drawMap} from "./src/render.js";', resolveDir: process.cwd() }, bundle: true, write: false, format: "iife", globalName: "combatTest" });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(s => {
    s.visible[5][4] = false;
    const events = [{ kind: "pulse", from: { x: 5, y: 5 }, range: 3, visible: true }, { kind: "impact", to: { x: 6, y: 5 }, amount: 3, visible: true }];
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 396;
    const c = canvas.getContext("2d");
    combatTest.drawMap(canvas, s);
    const fogBefore = [...c.getImageData(4 * 36, 5 * 36, 36, 36).data];
    combatTest.drawMap(canvas, s, { events, elapsed: 140, reduced: false });
    const fogAfter = [...c.getImageData(4 * 36, 5 * 36, 36, 36).data];
    const texts = []; const fill = c.fillText.bind(c);
    c.fillText = (text, x, y) => { if (text.startsWith("−")) texts.push({ text, x, y }); fill(text, x, y); };
    for (const elapsed of [80, 200]) combatTest.drawMap(canvas, s, { events, elapsed, reduced: true });
    return { fogBefore, fogAfter, texts };
  }, arena());
  expect(result.fogAfter).toEqual(result.fogBefore);
  expect(result.texts[0]).toEqual(result.texts[1]);
});
