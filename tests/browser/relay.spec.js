import { test, expect } from "@playwright/test";
import { newRun, chooseUpgrade, act, encodeSave } from "../../src/game.js";
const press = async (page, key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(85);
};
function scene(charges = 0) {
  const s = newRun(2);
  s.phase = "upgrade";
  s.choices = ["blade", "shell", "power"];
  chooseUpgrade(s, "blade");
  s.enemies = [];
  s.player.charges = charges;
  Object.assign(s.player, s.relay);
  act(s, "wait");
  return s;
}
async function open(page, s) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem("fogfall.run.v1"))
      localStorage.setItem("fogfall.run.v1", save);
  }, encodeSave(s));
  await page.goto("./");
  await press(page, "Enter");
}
test("manual relay work uses side actions and survives an offline interruption", async ({
  page,
  context,
}) => {
  await open(page, scene());
  await expect(page.locator(".district-top")).toContainText(
    "LANTERN RELAY 1/3",
  );
  await press(page, "Enter");
  await press(page, "ArrowDown");
  await expect(page.getByRole("button", { name: /Tune relay/ })).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator(".district-top")).toContainText(
    "LANTERN RELAY 2/3",
  );
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
  await context.setOffline(true);
  await page.reload();
  await press(page, "Enter");
  await expect(page.locator(".district-top")).toContainText(
    "LANTERN RELAY 2/3",
  );
  await press(page, "Enter");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator(".district-top")).toContainText(
    "LANTERN NETWORK ONLINE",
  );
  await expect(page.locator("[data-turn]")).toHaveText("3");
  const s = JSON.parse(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).state;
  expect(s.player.charges).toBe(0);
  expect(s.relay.progress).toBe(3);
});
test("a pulse powers the relay in one turn and the scene fits the display", async ({
  page,
}) => {
  await open(page, scene(1));
  await press(page, "Enter");
  await press(page, "Enter");
  await expect(page.locator(".district-top")).toContainText(
    "LANTERN NETWORK ONLINE",
  );
  const s = JSON.parse(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).state;
  expect(s.turn).toBe(2);
  expect(s.player.charges).toBe(0);
  const top = await page.locator(".district-top .eyebrow").boundingBox(),
    turn = await page.locator(".district-top .small").boundingBox();
  expect(top.x + top.width).toBeLessThanOrEqual(turn.x);
  await expect(page.locator(".map")).toBeFocused();
});
