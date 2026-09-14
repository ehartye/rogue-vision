import { test, expect } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";

const press = async (page, key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(85);
};
async function enter(page, configure = () => {}) {
  const run = newRun(2);
  run.floor = 1;
  run.enemies[0].intent = [{ x: 1, y: 1 }];
  configure(run);
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

test("injured and stunned hostiles retain their status marks on a threatened tile", async ({
  page,
}) => {
  await enter(page, (run) => {
    Object.assign(run.enemies[0], { x: 2, y: 1, hp: 1, stun: 1, intent: [] });
    run.enemies[1].intent = [{ x: 2, y: 1 }];
  });
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
  const marks = await page.locator(".map").evaluate((c) => {
    const ctx = c.getContext("2d");
    return {
      health: Array.from(ctx.getImageData(98, 69, 1, 1).data),
      stun: Array.from(ctx.getImageData(90, 39, 1, 1).data),
    };
  });
  expect(marks.health).toEqual([68, 35, 38, 255]);
  expect(marks.stun).toEqual([128, 232, 255, 255]);
});

test("people repaint while scenery is still loading, without waiting for input", async ({
  page,
}) => {
  let release, releasePeople;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const peopleGate = new Promise((resolve) => {
    releasePeople = resolve;
  });
  await page.route("**/assets/art/people.png", async (route) => {
    await peopleGate;
    await route.continue();
  });
  await page.route("**/assets/art/chinatown-frontage.png", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await enter(page);
    releasePeople();
    await expect
      .poll(() =>
        page
          .locator(".map")
          .evaluate((c) =>
            Array.from(c.getContext("2d").getImageData(52, 40, 1, 1).data),
          ),
      )
      .toEqual([128, 232, 255, 255]);
    await expect(page.locator("[data-turn]")).toHaveText("0");
  } finally {
    releasePeople();
    release();
  }
});
