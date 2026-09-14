import { test, expect } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";

const press = async (page, key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(85);
};
async function enter(page) {
  const run = newRun(2);
  run.floor = 1;
  run.enemies[0].intent = [{ x: 1, y: 1 }];
  const save = encodeSave(run);
  await page.addInitScript((save) => {
    if (!localStorage.getItem("fogfall.run.v1"))
      localStorage.setItem("fogfall.run.v1", save);
  }, save);
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await press(page, "Enter");
}
const pixels = (page) => page.locator(".map").evaluate((c) => c.toDataURL());

test("people and Chinatown art survive a cold offline reload without changing the save", async ({
  page,
  context,
}) => {
  await enter(page);
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  const before = await pixels(page);
  const save = await page.evaluate(() =>
    localStorage.getItem("fogfall.run.v1"),
  );
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat(),
  );
  expect(cached).toEqual(
    expect.arrayContaining([
      "/rogue-vision/assets/art/people.png",
      "/rogue-vision/assets/art/chinatown-frontage.png",
    ]),
  );
  await context.setOffline(true);
  await page.reload();
  await press(page, "Enter");
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
  expect(await pixels(page)).toBe(before);
  expect(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).toBe(save);
});

test("attack warnings stay above the player and art loading preserves side-action focus", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/art/*.png", async (route) => {
    await gate;
    await route.continue();
  });
  await enter(page);
  await press(page, "Enter");
  await expect(page.locator('[data-action="pulse"]')).toBeFocused();
  const save = await page.evaluate(() =>
    localStorage.getItem("fogfall.run.v1"),
  );
  release();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
  await expect(page.locator('[data-action="pulse"]')).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).toBe(save);
  const border = await page
    .locator(".map")
    .evaluate((c) =>
      Array.from(c.getContext("2d").getImageData(38, 54, 1, 1).data),
    );
  expect(border).toEqual([255, 130, 125, 255]);
  expect(await page.locator(".map").boundingBox()).toMatchObject({
    width: 396,
    height: 396,
  });
});

test("failed art requests keep the fallback map playable", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/assets/art/*.png", (route) => route.abort());
  await enter(page);
  await expect(page.locator(".map")).toHaveAttribute("data-art", "fallback");
  await expect(page.locator(".map")).toBeFocused();
  await press(page, "ArrowRight");
  await expect(page.locator("[data-turn]")).toHaveText("1");
  expect(errors).toEqual([]);
});
