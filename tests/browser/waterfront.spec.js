import { test, expect } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";

function scene() {
  const s = newRun(9);
  s.enemies = [];
  s.items = [];
  s.landmark = { x: 2, y: 1, resolved: false };
  return s;
}
async function open(page, s) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem("fogfall.run.v1"))
      localStorage.setItem("fogfall.run.v1", save);
  }, encodeSave(s));
  await page.goto("./");
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
}
const press = async (page, key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(90);
};

test("Ferry Building is identifiable and its existing supply visit survives offline resume", async ({
  page,
  context,
}) => {
  await open(page, scene());
  await expect(page.locator(".map")).toHaveAttribute(
    "aria-label",
    /Ferry Building.*Enter its square/,
  );
  await expect(page.locator(".side-bottom")).toContainText("Ferry Building");
  await press(page, "ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Ferry Building" }),
  ).toBeVisible();
  await expect(
    page.getByText("Spend 1 pulse · repair up to 7 hull"),
  ).toBeVisible();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await press(page, "ArrowLeft");
  await expect(page.locator(".map")).toHaveAttribute(
    "aria-label",
    /Ferry Building.*visited/,
  );
  const before = await page.locator(".map").evaluate((c) => c.toDataURL());
  const save = await page.evaluate(() =>
    localStorage.getItem("fogfall.run.v1"),
  );
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
  expect(await page.locator(".map").evaluate((c) => c.toDataURL())).toBe(
    before,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).toBe(save);
});

test("the public tower beacon remains visible and below attack warnings", async ({
  page,
}) => {
  const s = scene();
  s.seen[1][2] = s.visible[1][2] = false;
  await open(page, s);
  const tower = await page
    .locator(".map")
    .evaluate((c) =>
      Array.from(c.getContext("2d").getImageData(90, 39, 1, 1).data),
    );
  expect(tower[3]).toBeGreaterThan(0);
  // Reveal the landmark and mark a hostile attack across its square.
  s.seen[1][2] = s.visible[1][2] = true;
  s.enemies = [
    {
      id: 0,
      kind: "spitter",
      x: 3,
      y: 1,
      hp: 5,
      maxHp: 5,
      stun: 0,
      intent: [{ x: 2, y: 1 }],
    },
  ];
  // The active app saves on pagehide. Seed the replacement after that save,
  // during the next document's initialization, rather than before reloading.
  await page.addInitScript(
    (save) => localStorage.setItem("fogfall.run.v1", save),
    encodeSave(s),
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume expedition" }).click();
  const border = await page
    .locator(".map")
    .evaluate((c) =>
      Array.from(c.getContext("2d").getImageData(74, 54, 1, 1).data),
    );
  expect(border).toEqual([255, 130, 125, 255]);
});
