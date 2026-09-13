import { test, expect } from "@playwright/test";
const press = async (page, key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(85);
};
test("a run, action menu, help, and resume are usable with wrist-equivalent keys only", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Enter the fog" }),
  ).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator('[data-screen="mission"]')).toBeVisible();
  const before = await page.locator("[data-turn]").textContent();
  await press(page, "ArrowRight");
  await expect(page.locator("[data-turn]")).not.toHaveText(before);
  await press(page, "Enter");
  await expect(
    page.getByRole("button", { name: /Discharge pulse/ }),
  ).toBeFocused();
  await press(page, "ArrowDown");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(
    page.getByRole("heading", { name: "Stay on the air" }),
  ).toBeVisible();
  await press(page, "Escape");
  await press(page, "Escape");
  await expect(page.locator('[data-screen="mission"]')).toBeVisible();
  await press(page, "Escape");
  await expect(
    page.getByRole("button", { name: "Resume expedition" }),
  ).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator('[data-screen="mission"]')).toBeVisible();
  expect(errors).toEqual([]);
});
test("legacy wrist keys move once and unidentified precursor consumes nothing", async ({
  page,
}) => {
  await page.goto("./");
  await press(page, "Enter");
  const turn = await page.locator("[data-turn]").textContent();
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Unidentified",
        keyCode: 0,
        bubbles: true,
      }),
    ),
  );
  await expect(page.locator("[data-turn]")).toHaveText(turn);
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++)
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Unidentified",
          keyCode: 39,
          bubbles: true,
        }),
      );
  });
  await expect(page.locator("[data-turn]")).toHaveText("1");
});
test("cached project-path app cold reloads offline and restores the expedition", async ({
  page,
  context,
}) => {
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("./");
  await expect(page.locator("[data-offline]")).toHaveText("Offline ready", {
    timeout: 15000,
  });
  await press(page, "Enter");
  await press(page, "ArrowRight");
  await press(page, "ArrowDown");
  const save = await page.evaluate(() =>
    localStorage.getItem("fogfall.run.v1"),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume expedition" }),
  ).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator("[data-turn]")).toHaveText("2");
  expect(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).toEqual(save);
  // Step back into the guaranteed clear starting area, not a random building.
  await press(page, "ArrowLeft");
  await expect(page.locator("[data-turn]")).toHaveText("3");
  expect(
    requests.every((url) =>
      url.startsWith("http://127.0.0.1:4173/rogue-vision/"),
    ),
  ).toBe(true);
});
test("all screens fit the glasses without scrolling and focus targets are large", async ({
  page,
}) => {
  await page.goto("./");
  for (let step = 0; step < 3; step++) {
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    for (const button of await page.locator("button:visible").all())
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(88);
    await press(page, "Enter");
  }
});
