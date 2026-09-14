import { test, expect, chromium } from "@playwright/test";
import { newRun, encodeSave } from "../../src/game.js";
import { newProfile, trackRun } from "../../src/profile.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const press = async (p, k) => {
  await p.keyboard.press(k);
  await p.waitForTimeout(80);
};
async function fit(page) {
  await page.evaluate(() => document.fonts.ready);
  for (const b of await page.locator("button").all()) {
    const box = await b.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(88);
    expect(box.y + box.height).toBeLessThan(560);
  }
  if (await page.locator(".loadout-note").count()) {
    const note = await page.locator(".loadout-note").boundingBox(),
      footer = await page.locator(".footline").boundingBox();
    expect(note.y + note.height).toBeLessThan(footer.y - 6);
  }
}
test("locked kits explain progress, preserve focus, and cannot start a run", async ({
  page,
}) => {
  await page.goto("./");
  await press(page, "Enter");
  await fit(page);
  await expect(page.getByRole("button", { name: /Courier/ })).toBeFocused();
  await press(page, "ArrowDown");
  await expect(page.locator(".loadout-note")).toContainText("refunds 1 charge");
  await press(page, "Enter");
  await expect(
    page.getByRole("button", { name: /Relay · Locked/ }),
  ).toBeFocused();
  await expect(page.locator(".loadout-note")).toContainText("0/10 kills");
  expect(
    await page.evaluate(() => localStorage.getItem("fogfall.run.v1")),
  ).toBeNull();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator(".loadout-note")).toContainText("0/3 districts");
  await press(page, "Escape");
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
});
test("a failed expedition earns unlocks once and can start Relay entirely through wrist controls", async ({
  page,
}) => {
  const run = newRun(8);
  run.id = "failed";
  run.kills = 10;
  run.floor = 2;
  run.phase = "dead";
  run.player.hp = 0;
  const profile = newProfile();
  trackRun(profile, run);
  await page.addInitScript(
    ({ save, profile }) => {
      if (!localStorage.getItem("fogfall.run.v1")) {
        localStorage.setItem("fogfall.run.v1", save);
        localStorage.setItem("fogfall.profile.v1", JSON.stringify(profile));
      }
    },
    { save: encodeSave(run), profile },
  );
  await page.goto("./");
  await page.reload();
  await press(page, "Enter");
  await expect(page.getByRole("button", { name: /Relay/ })).not.toContainText(
    "Locked",
  );
  await expect(page.getByRole("button", { name: /Breaker/ })).toContainText(
    "2/3 districts",
  );
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator("[data-turn]")).toHaveText("0");
  const stored = await page.evaluate(() => ({
    run: JSON.parse(localStorage.getItem("fogfall.run.v1")).state,
    profile: JSON.parse(localStorage.getItem("fogfall.profile.v1")),
  }));
  expect(stored.run).toMatchObject({
    kit: "relay",
    player: { hp: 14, attack: 2, charges: 3 },
  });
  expect(stored.profile).toMatchObject({ runs: 2, kills: 10, districts: 2 });
});
test("build summary fits three modifications and pauses the expedition", async ({
  page,
}) => {
  const run = newRun(9, "relay");
  run.relics = ["aftershock", "kinetic", "siphon"];
  run.meleeHits = 1;
  await page.addInitScript(
    (save) => localStorage.setItem("fogfall.run.v1", save),
    encodeSave(run),
  );
  await page.goto("./");
  await press(page, "Enter");
  await press(page, "Enter");
  await press(page, "ArrowDown");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(
    page.getByRole("dialog", { name: "Expedition options" }),
  ).toBeVisible();
  await press(page, "Enter");
  await expect(
    page.getByRole("heading", { name: "Relay build" }),
  ).toBeVisible();
  await fit(page);
  const mods = await page.locator(".build-mods").boundingBox(),
    button = await page.locator(".guide-next").boundingBox();
  expect(mods.y + mods.height).toBeLessThan(button.y - 6);
  await expect(page.getByText("Aftershock blade")).toBeVisible();
  await page.screenshot({ path: ".artifacts/relay-build.png" });
  await press(page, "Enter");
  await press(page, "Escape");
  await press(page, "Escape");
  await expect(page.locator("[data-turn]")).toHaveText("0");
});
test("corrupt profile recovery is visible and preserves legacy totals", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("fogfall.profile.v1", "{bad");
    localStorage.setItem(
      "fogfall.stats.v1",
      JSON.stringify({ runs: 8, wins: 2, best: 910 }),
    );
  });
  await page.goto("./");
  await expect(page.getByText("BEST 910")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Enter the fog/ }),
  ).toContainText("Progress was damaged; recovered old totals.");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(
    page.getByText("Progress was damaged; recovered old totals."),
  ).toBeVisible();
});
test("repeated partial new-run saves recover the old run and keep awarding kills", async ({
  page,
}) => {
  const run = newRun(1);
  run.id = "durable";
  run.kills = 3;
  run.items = [];
  run.enemies = [
    { id: 0, x: 2, y: 1, hp: 3, maxHp: 3, kind: "runner", stun: 0, intent: [] },
  ];
  const profile = newProfile();
  trackRun(profile, run);
  await page.addInitScript(
    ({ save, profile }) => {
      if (!localStorage.getItem("fogfall.run.v1")) {
        localStorage.setItem("fogfall.run.v1", save);
        localStorage.setItem("fogfall.profile.v1", JSON.stringify(profile));
      }
    },
    { save: encodeSave(run), profile },
  );
  await page.goto("./");
  await press(page, "Enter");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "fogfall.run.v1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  const choose = async (action) => {
    for (
      let i = 0;
      i < 4 &&
      (await page.locator(":focus").getAttribute("data-action")) !== action;
      i++
    )
      await press(page, "ArrowDown");
    await expect(page.locator(":focus")).toHaveAttribute("data-action", action);
    await press(page, "Enter");
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    for (
      let back = 0;
      back < 5 && !(await page.locator('[data-screen="title"]').count());
      back++
    )
      await press(page, "Escape");
    await choose("kit");
    await choose("start");
    await expect(
      page.getByRole("button", { name: "Keep this run" }),
    ).toBeFocused();
    await choose("restart");
    await choose("kit:courier");
    await expect(page.locator("[data-turn]")).toHaveText("0");
    await expect(page.locator(".footline")).toContainText("NOT SAVED");
  }
  const interrupted = await page.evaluate(() => ({
    save: JSON.parse(localStorage.getItem("fogfall.run.v1")).state,
    profile: JSON.parse(localStorage.getItem("fogfall.profile.v1")),
  }));
  expect(interrupted.save.id).toBe("durable");
  expect(interrupted.profile.previous.id).toBe("durable");
  await page.reload();
  await press(page, "Enter");
  await press(page, "ArrowRight");
  const restored = await page.evaluate(() => ({
    save: JSON.parse(localStorage.getItem("fogfall.run.v1")).state,
    profile: JSON.parse(localStorage.getItem("fogfall.profile.v1")),
  }));
  expect(restored.save.kills).toBe(4);
  expect(restored.profile.kills).toBe(4);
  expect(restored.profile.current.id).toBe("durable");
});
test("unlocked kit and progress survive complete browser shutdown and offline relaunch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fogfall-kits-"));
  let context = await chromium.launchPersistentContext(dir, {
    headless: true,
    viewport: { width: 600, height: 600 },
  });
  try {
    let page = context.pages()[0];
    const profile = newProfile();
    profile.kills = 10;
    profile.districts = 3;
    await context.addInitScript((p) => {
      if (!localStorage.getItem("fogfall.profile.v1"))
        localStorage.setItem("fogfall.profile.v1", JSON.stringify(p));
    }, profile);
    await page.goto("http://127.0.0.1:4173/rogue-vision/");
    await expect(page.locator("[data-offline]")).toHaveText("Offline ready");
    await press(page, "Enter");
    await press(page, "ArrowDown");
    await press(page, "Enter");
    await press(page, "ArrowRight");
    await expect(page.locator("[data-turn]")).toHaveText("1");
    await context.close();
    context = await chromium.launchPersistentContext(dir, {
      headless: true,
      offline: true,
      viewport: { width: 600, height: 600 },
    });
    page = context.pages()[0];
    await page.goto("http://127.0.0.1:4173/rogue-vision/");
    await press(page, "Enter");
    await expect(page.locator("[data-turn]")).toHaveText("1");
    const stored = await page.evaluate(() => ({
      run: JSON.parse(localStorage.getItem("fogfall.run.v1")).state,
      profile: JSON.parse(localStorage.getItem("fogfall.profile.v1")),
    }));
    expect(stored.run.kit).toBe("relay");
    expect(stored.profile).toMatchObject({ kills: 10, districts: 3, runs: 1 });
  } finally {
    await context.close();
  }
});
