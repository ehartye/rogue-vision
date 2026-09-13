import { test, expect } from "@playwright/test";
import { newRun, act, encodeSave } from "../../src/game.js";
test("landmark tradeoffs, passing and offline resume work with only wrist keys", async ({
  page,
  context,
}) => {
  const run = newRun(9);
  run.enemies = [];
  run.items = [];
  run.landmark = { x: 2, y: 1, resolved: false };
  run.player.charges = 0;
  act(run, "right");
  await page.addInitScript((save) => {
    if (!localStorage.getItem("fogfall.run.v1"))
      localStorage.setItem("fogfall.run.v1", save);
  }, encodeSave(run));
  await page.goto("./");
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  const press = async (key) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  };
  await press("Enter");
  await expect(page.locator('[data-screen="encounter"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ferry Building" }),
  ).toBeVisible();
  await expect(page.getByText("Spend 1 pulse · repair up to 7 hull")).toBeVisible();
  await expect(page.getByText("Hull 18/18 · Pulses 0/3")).toBeVisible();
  await press("Enter");
  await expect(
    page.getByText("Not enough resources. You can pass by safely."),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await press("Enter");
  await expect(page.locator('[data-screen="encounter"]')).toBeVisible();
  await press("ArrowDown");
  await press("Enter");
  await expect(page.locator('[data-screen="mission"]')).toBeVisible();
  await expect(page.locator("[data-turn]")).toHaveText("1");
});
