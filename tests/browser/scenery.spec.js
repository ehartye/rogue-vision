import { test, expect } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";

function scene(floor) {
  const s = newRun(19, "courier", 1);
  s.floor = floor;
  s.enemies = [];
  s.items = [];
  delete s.landmark;
  s.tiles = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) =>
      x === 0 ||
      x === 10 ||
      y === 0 ||
      y === 10 ||
      (y === 2 && x >= 2 && x <= 6)
        ? 1
        : 0,
    ),
  );
  s.seen = s.visible = Array.from({ length: 11 }, () => Array(11).fill(true));
  return s;
}
async function open(page, s) {
  await page.goto("./");
  await page.evaluate(
    (save) => localStorage.setItem("fogfall.run.v1", save),
    encodeSave(s),
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume expedition" }).click();
  await expect(page.locator(".map")).toHaveAttribute("data-art", "ready");
}

test("adjacent walls share a continuous structure in every district", async ({
  page,
}) => {
  for (let floor = 0; floor < 4; floor++) {
    await open(page, scene(floor));
    const seam = await page.locator(".map").evaluate((c) => {
      const ctx = c.getContext("2d");
      return Array.from(
        { length: 4 },
        (_, i) => ctx.getImageData((i + 3) * 36, 2 * 36 + 18, 1, 1).data[3],
      );
    });
    expect(seam, `continuous wall surface, district ${floor}`).toEqual([
      255, 255, 255, 255,
    ]);
  }
});

test("hidden neighbouring terrain cannot change the visible scenery", async ({
  page,
}) => {
  for (let floor = 0; floor < 4; floor++) {
    const s = scene(floor);
    s.seen[2][4] = false;
    s.visible[2][4] = false;
    await open(page, s);
    const before = await page.locator(".map").evaluate((c) => c.toDataURL());
    s.tiles[2][4] = 0;
    await open(page, s);
    expect(await page.locator(".map").evaluate((c) => c.toDataURL())).toBe(
      before,
    );
  }
});
