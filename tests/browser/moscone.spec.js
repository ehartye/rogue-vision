import { test, expect } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";
test("registration entrance identifies the existing badge choice and retains visited art offline", async ({
  page,
  context,
}) => {
  const s = newRun(9, "courier", 1);
  s.floor = 3;
  s.enemies = [];
  s.items = [];
  s.landmark = { x: 2, y: 1, resolved: false };
  await page.addInitScript((save) => {
    if (!localStorage.getItem("fogfall.run.v1"))
      localStorage.setItem("fogfall.run.v1", save);
  }, encodeSave(s));
  await page.goto("./");
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute(
    "aria-label",
    /Moscone registration.*Enter its square/,
  );
  await expect(page.locator(".side-bottom")).toContainText("Registration");
  const press = async (key) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(90);
  };
  await press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Moscone registration" }),
  ).toBeVisible();
  await expect(
    page.getByText("Spend 2 pulses · +1 attack · up to 6 hull"),
  ).toBeVisible();
  await press("ArrowDown");
  await press("Enter");
  await press("ArrowLeft");
  await expect(page.locator(".map")).toHaveAttribute(
    "aria-label",
    /Moscone registration.*visited/,
  );
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  const pixels = await page.locator(".map").evaluate((c) => c.toDataURL());
  const save = await page.evaluate(() =>
    localStorage.getItem("fogfall.run.v1"),
  );
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
  expect(await page.locator(".map").evaluate((c) => c.toDataURL())).toBe(
    pixels,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).toBe(save);
});
