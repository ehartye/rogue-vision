import { test, expect } from "@playwright/test";
import { newRun, act, encodeSave } from "../../src/game.js";
const press = async (p, k) => {
  await p.keyboard.press(k);
  await p.waitForTimeout(85);
};
test("title narrative is not covered by its actions", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => document.fonts.ready);
  const story = await page.locator(".title-story").boundingBox(),
    buttons = await page.locator(".title-actions").boundingBox();
  expect(story.y + story.height).toBeLessThanOrEqual(buttons.y - 6);
});
test("an active run can be deliberately abandoned with a safe default", async ({
  page,
}) => {
  await page.goto("./");
  await press(page, "Enter");
  await press(page, "Escape");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  const restart = page.getByRole("button", { name: /New expedition/ });
  await expect(restart).toBeVisible();
  await press(page, "ArrowUp");
  await press(page, "Enter");
  await expect(
    page.getByRole("button", { name: "Keep this run" }),
  ).toBeFocused();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator("[data-turn]")).toHaveText("0");
});
test("guide text does not overlap navigation on any page", async ({ page }) => {
  await page.goto("./");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await press(page, "Enter");
  for (let i = 0; i < 3; i++) {
    const text = await page.locator(".guide-copy").boundingBox(),
      next = await page.locator(".guide-next").boundingBox();
    expect(text.y + text.height).toBeLessThanOrEqual(next.y - 6);
    await press(page, "Enter");
  }
});
test("small and wide viewports keep the complete composition centered", async ({
  page,
}) => {
  for (const size of [
    { width: 390, height: 800 },
    { width: 320, height: 800 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("./");
    const box = await page.locator("#app").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  }
});
test("upgrade footer text never overlaps the controls", async ({ page }) => {
  const run = newRun(1);
  for (const action of [
    "right",
    "right",
    "right",
    "right",
    "down",
    "right",
    "right",
    "right",
    "right",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
  ])
    act(run, action);
  expect(run.phase).toBe("upgrade");
  await page.addInitScript(
    (save) => localStorage.setItem("fogfall.run.v1", save),
    encodeSave(run),
  );
  await page.goto("./");
  await page.keyboard.press("Enter");
  await page.evaluate(() => document.fonts.ready);
  const note = page.locator(".panel-foot");
  if (await note.count()) {
    const a = await note.boundingBox(),
      b = await page.locator(".footline").boundingBox();
    expect(a.y + a.height).toBeLessThanOrEqual(b.y - 6);
  }
});
