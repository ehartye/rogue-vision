import { test, expect } from "@playwright/test";
import { newRun, chooseUpgrade, encodeSave } from "../../src/game.js";
test("Dragon Gate identifies the existing optional recharge choice and retains visited art offline", async ({
  page,
  context,
}) => {
  const s = newRun(9, "courier", 1);
  s.floor = 1;
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
    /Dragon Gate.*Enter its square/,
  );
  await expect(page.locator(".side-bottom")).toContainText("Dragon Gate");
  const press = async (key) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(90);
  };
  await press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Dragon Gate" }),
  ).toBeVisible();
  await expect(
    page.getByText("Lose 3 hull · up to 2 pulses + 60 points"),
  ).toBeVisible();
  await press("ArrowDown");
  await press("Enter");
  await press("ArrowLeft");
  await expect(page.locator(".map")).toHaveAttribute(
    "aria-label",
    /Dragon Gate.*visited/,
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

test("Dragon Gate and the required lantern relay stay distinct without sprite assets", async ({ page }) => {
  const s = newRun(2);
  s.phase = "upgrade";
  s.choices = ["blade", "shell", "power"];
  chooseUpgrade(s, "blade");
  await page.route("**/assets/art/*.png", route => route.abort());
  await page.addInitScript(save => localStorage.setItem("fogfall.run.v1", save), encodeSave(s));
  await page.goto("./");
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "fallback");
  await expect(page.locator(".map")).toHaveAttribute("aria-label", /Dragon Gate.*optional recharge choice.*Lantern relay.*0\/3/);
  await expect(page.locator(".side-bottom")).toContainText("Dragon Gate");
  await expect(page.locator(".side-bottom")).toContainText("Lantern relay");
  const layout = await page.evaluate(() => {
    const legend = document.querySelector(".side-bottom").getBoundingClientRect();
    const threat = document.querySelector(".threat-note").getBoundingClientRect();
    return { bottom: legend.bottom, top: legend.top, threatBottom: threat.bottom };
  });
  expect(layout.bottom).toBeLessThanOrEqual(522);
  expect(layout.top).toBeGreaterThan(layout.threatBottom);
  // The public fallback has its own roof and entrance even in unexplored fog.
  const gate = await page.locator(".map").evaluate((canvas, p) => {
    const c = canvas.getContext("2d");
    return [c.getImageData(p.x * 36 + 18, p.y * 36 + 12, 1, 1).data[3],
      c.getImageData(p.x * 36 + 3, p.y * 36 + 33, 1, 1).data[3]];
  }, s.landmark);
  expect(gate.every(alpha => alpha > 0)).toBe(true);
});
