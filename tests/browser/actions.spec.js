import { test, expect } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";

const press = async (page, key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(85);
};
async function enter(page, charges = 2) {
  const run = newRun(2);
  run.player.charges = charges;
  await page.addInitScript(
    (save) => localStorage.setItem("fogfall.run.v1", save),
    encodeSave(run),
  );
  await page.goto("./");
  const initialHistoryLength = await page.evaluate(() => history.length);
  await press(page, "Enter");
  await page.evaluate(() => document.fonts.ready);
  return initialHistoryLength;
}
const saved = (page) =>
  page.evaluate(() => localStorage.getItem("fogfall.run.v1"));

test("pinch opens side actions without moving or obscuring the tactical map", async ({
  page,
}) => {
  await enter(page);
  const before = await saved(page);
  const map = page.locator(".map");
  const box = await map.boundingBox();
  const pixels = await map.evaluate((canvas) => canvas.toDataURL());
  const threat = await page.locator(".threat-note").textContent();
  await press(page, "Enter");
  await expect(page.locator('.sidebar [data-action="pulse"]')).toBeFocused();
  expect(await map.boundingBox()).toEqual(box);
  expect(await map.evaluate((canvas) => canvas.toDataURL())).toEqual(pixels);
  await expect(page.locator(".threat-note")).toHaveText(threat);
  await expect(page.locator(".vitals")).toBeVisible();
  await page.screenshot({ path: ".artifacts/side-actions.png" });
  for (const button of await page.locator(".sidebar button").all()) {
    const rect = await button.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(box.x + box.width);
    expect(rect.x + rect.width).toBeLessThanOrEqual(600);
    expect(rect.height).toBeGreaterThanOrEqual(88);
    expect(rect.y + rect.height).toBeLessThanOrEqual(box.y + box.height);
  }
  await press(page, "ArrowDown");
  await expect(page.locator('[data-action="wait"]')).toBeFocused();
  expect(await saved(page)).toBe(before);
  await press(page, "Escape");
  await expect(map).toBeFocused();
  expect(await saved(page)).toBe(before);
});

test("pulse and wait each spend one turn and return control to movement", async ({
  page,
}) => {
  await enter(page);
  for (const action of ["pulse", "wait"]) {
    const before = JSON.parse(await saved(page)).state;
    await press(page, "Enter");
    if (action === "wait") await press(page, "ArrowDown");
    await press(page, "Enter");
    await expect(page.locator(".map")).toBeFocused();
    await expect(page.locator("[data-turn]")).toHaveText(
      String(before.turn + 1),
    );
    const after = JSON.parse(await saved(page)).state;
    expect(after.player.charges).toBe(
      before.player.charges - (action === "pulse" ? 1 : 0),
    );
  }
  await press(page, "Escape");
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
});

test("empty pulse explains its availability and cannot spend a turn", async ({
  page,
}) => {
  await enter(page, 0);
  const before = await saved(page);
  await press(page, "Enter");
  const pulse = page.locator('.sidebar [data-action="pulse"]');
  await expect(pulse).toHaveAttribute("aria-disabled", "true");
  await expect(pulse).toContainText("No charges");
  await page.screenshot({ path: ".artifacts/side-actions-empty.png" });
  await press(page, "Enter");
  await expect(pulse).toBeFocused();
  expect(await saved(page)).toBe(before);
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator("[data-turn]")).toHaveText("1");
});

test("More and build are modal, hold time, and restore side-panel focus", async ({
  page,
}) => {
  await enter(page);
  const before = await saved(page);
  await press(page, "Enter");
  await press(page, "ArrowUp");
  await expect(page.locator('[data-action="more"]')).toBeFocused();
  await press(page, "Enter");
  await expect(
    page.getByRole("dialog", { name: "Expedition options" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Your build/ })).toBeFocused();
  await page.screenshot({ path: ".artifacts/side-actions-more.png" });
  await press(page, "Shift+Tab");
  await expect(
    page.getByRole("button", { name: /Return to actions/ }),
  ).toBeFocused();
  await press(page, "Tab");
  await press(page, "Enter");
  await expect(page.getByRole("dialog", { name: "Your build" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Courier build" }),
  ).toBeVisible();
  await press(page, "Enter");
  await expect(page.getByRole("button", { name: /Your build/ })).toBeFocused();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.getByRole("button", { name: /Sound: on/ })).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator('[data-action="more"]')).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator(".map")).toBeFocused();
  expect(await saved(page)).toBe(before);
});

test("replacement runs keep native history within five app entries, including build", async ({
  page,
}) => {
  const initialHistoryLength = await enter(page);
  await press(page, "Escape");
  await press(page, "ArrowDown");
  await press(page, "Enter"); // Field kit
  await press(page, "ArrowUp");
  await press(page, "Enter"); // New expedition
  await press(page, "ArrowDown");
  await press(page, "Enter"); // Confirm
  await press(page, "Enter"); // Courier
  await press(page, "Enter"); // Actions
  await press(page, "ArrowUp");
  await press(page, "Enter"); // More
  await press(page, "Enter"); // Build
  await expect(page.getByRole("dialog", { name: "Your build" })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(
    initialHistoryLength + 4,
  );
  await press(page, "Escape");
  await expect(page.locator('.sidebar [data-action="more"]')).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator(".map")).toBeFocused();
  await expect(page.locator("[data-turn]")).toHaveText("0");
});
