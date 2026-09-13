import { test, expect, chromium } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const route = [
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
  "upgrade:blade",
  "right",
  "right",
  "right",
  "right",
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
  "down",
  "down",
  "upgrade:blade",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "down",
  "right",
  "down",
  "down",
  "right",
  "right",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "upgrade:siphon",
  "down",
  "down",
  "down",
  "right",
  "down",
  "down",
  "wait",
  "wait",
  "down",
  "down",
  "right",
  "pulse",
  "pulse",
  "down",
  "down",
  "pulse",
  "down",
  "down",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
];
test("complete a seeded expedition through every district and boss using only wrist controls", async ({
  page,
}) => {
  await page.addInitScript(
    (save) => localStorage.setItem("fogfall.run.v1", save),
    encodeSave(newRun(1)),
  );
  await page.goto("./");
  await page.evaluate(() => document.fonts.ready);
  const press = async (key) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(70);
  };
  await press("Enter");
  let upgrades = 0;
  for (const action of route) {
    if (action.startsWith("upgrade:")) {
      await expect(page.locator('[data-screen="upgrade"]')).toBeVisible();
      upgrades++;
      const wanted = action.slice(8);
      for (let tries = 0; tries < 3; tries++) {
        if (
          (await page.locator(":focus").getAttribute("data-action")) ===
          `upgrade:${wanted}`
        )
          break;
        await press("ArrowDown");
      }
      await press("Enter");
    } else if (action === "pulse" || action === "wait") {
      await press("Enter");
      if (action === "wait") await press("ArrowDown");
      await press("Enter");
    } else await press("Arrow" + action[0].toUpperCase() + action.slice(1));
  }
  await expect(page.locator('[data-screen="won"]')).toBeVisible();
  expect(upgrades).toBe(3);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("fogfall.run.v1")).state,
  );
  expect(saved).toMatchObject({
    phase: "won",
    turn: 83,
    score: 1070,
    kills: 13,
  });
  for (const b of await page.locator("button").all()) {
    const box = await b.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(592);
  }
  await mkdir(".artifacts", { recursive: true });
  await page.screenshot({ path: ".artifacts/victory.png" });
  await press("Enter");
  await expect(page.locator("[data-turn]")).toHaveText("0");
});

test("storage denial and cache loss are visible without preventing play", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("./");
  await page.keyboard.press("Enter");
  await expect(page.locator(".footline")).toContainText("NOT SAVED");
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  await page.evaluate(async () => {
    for (const key of await caches.keys())
      if (key.startsWith("fogfall-")) await caches.delete(key);
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.locator("[data-offline]")).toHaveText(
    "Offline files missing",
  );
});
test("saved cache and expedition survive a complete browser shutdown and offline restart", async () => {
  const profile = await mkdtemp(join(tmpdir(), "fogfall-offline-"));
  let context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 600, height: 600 },
  });
  try {
    const page = context.pages()[0];
    await page.goto("http://127.0.0.1:4173/rogue-vision/");
    await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-turn]")).toHaveText("1");
    await context.close();
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      offline: true,
      viewport: { width: 600, height: 600 },
    });
    const offlinePage = context.pages()[0];
    await offlinePage.goto("http://127.0.0.1:4173/rogue-vision/");
    await expect(
      offlinePage.getByRole("button", { name: "Resume expedition" }),
    ).toBeFocused();
    await offlinePage.keyboard.press("Enter");
    await expect(offlinePage.locator("[data-turn]")).toHaveText("1");
  } finally {
    await context.close();
  }
});
