import { KITS } from "./kits.js";
import {
  newProfile,
  readProfile,
  trackRun,
  creditRun,
  kitUnlocked,
  unlockProgress,
  resumeRun,
  acknowledgeRun,
} from "./profile.js";
import {
  newRun,
  act,
  actionEvents,
  chooseUpgrade,
  chooseEncounter,
  LANDMARKS,
  encodeSave,
  decodeSave,
  DISTRICTS,
  UPGRADES,
} from "./game.js";
import { createInputFilter, decodeKey } from "./input.js";
import { drawMap, drawSkyline, mapDescription } from "./render.js";
import { createAudio } from "./audio.js";
import { musicState } from "./score.js";
const audio = createAudio();
const app = document.querySelector("#app"),
  SAVE = "fogfall.run.v1",
  STATS = "fogfall.stats.v1",
  PROFILE = "fogfall.profile.v1";
let run = null,
  saveState = "Saved locally",
  cacheState = "Preparing offline",
  renderMs = 0,
  lastKey = "None yet",
  sound = false,
  guidePage = 0;
let profile = newProfile(),
  recoveryNotice = "",
  progressNotice = "",
  storageOk = true;
try {
  const raw = localStorage.getItem(SAVE);
  run = decodeSave(raw);
  if (raw && !run) saveState = "Unreadable save";
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(STATS));
  } catch {}
  const loaded = readProfile(localStorage.getItem(PROFILE), legacy);
  profile = loaded.profile;
  if (loaded.recovered)
    recoveryNotice = "Progress was damaged; recovered old totals.";
  if (run) {
    run.id ??= "legacy:" + run.seed;
    if (!resumeRun(profile, run))
      recoveryNotice = "Run recovered; new progress will count.";
    creditRun(profile, run);
  }
  sound = localStorage.getItem("fogfall.sound") === "on";
} catch {
  storageOk = false;
  saveState = "Saving unavailable";
}
audio.setEnabled(sound);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let screen = "title",
  focusIndex = 0;
history.replaceState({ screen: "title", focus: 0 }, "");
function resize() {
  app.style.transform = `translate(-50%, -50%) scale(${Math.min(1, innerWidth / 600, innerHeight / 600)})`;
}
resize();
addEventListener("resize", resize);
function persist() {
  try {
    if (run) creditRun(profile, run);
    // Award receipt first: replaying a stale run after an interrupted write is safe.
    localStorage.setItem(PROFILE, JSON.stringify(profile));
    if (run) {
      localStorage.setItem(SAVE, encodeSave(run));
      acknowledgeRun(profile, run);
    }
    storageOk = true;
    saveState = "Saved locally";
  } catch {
    storageOk = false;
    saveState = "Saving unavailable";
  }
}
function button(action, title, detail = "", primary = false) {
  return `<button class="focusable menu-button ${primary ? "primary" : ""}" data-action="${action}"><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ""}</span><span class="marker" aria-hidden="true">›</span></button>`;
}
function foot(left = "Swipe to choose · Pinch to select") {
  return `<div class="footline"><span>${left}</span><span data-offline>${cacheState}</span></div>`;
}
function heading(eyebrow, title, intro = "") {
  return `<p class="eyebrow">${eyebrow}</p><h2 class="panel-heading">${title}</h2>${intro ? `<p class="panel-intro">${intro}</p>` : ""}`;
}
function go(next) {
  history.replaceState({ screen, focus: focusIndex }, "");
  history.pushState({ screen: next, focus: 0 }, "");
  screen = next;
  focusIndex = 0;
  render();
}
function back() {
  if (screen !== "title") history.back();
}
addEventListener("popstate", (e) => {
  screen = e.state?.screen ?? "title";
  focusIndex = e.state?.focus ?? 0;
  render();
});
function settleAction(action) {
  act(run, action);
  persist();
  audio.play(actionEvents(run));
  render();
}
function render() {
  if (!run && ["mission", "actions"].includes(screen)) screen = "title";
  audio.setScene(screen === "mission" ? musicState(run) : null);
  app.className = "";
  let html = "";
  if (screen === "title") {
    const active =
      run && ["playing", "upgrade", "encounter"].includes(run.phase);
    html = `<section class="screen" data-screen="title"><div class="title-top"><p class="eyebrow">ROGUE VISION / SAN FRANCISCO</p><span class="small muted">BEST ${profile.best}</span></div><h1 class="brand">FOG<span>FALL</span></h1><p class="subtitle">THE CITY LOST ITS SIGNAL. YOU DIDN’T.</p><canvas class="skyline" width="600" height="180" aria-hidden="true"></canvas><p class="title-story">A dead city. A live keynote. Find daylight.</p><div class="title-actions">${button(active ? "resume" : "start", active ? "Resume expedition" : "Enter the fog", recoveryNotice || (active ? `${DISTRICTS[run.floor].name} · Hull ${run.player.hp}/${run.player.maxHp} · Turn ${run.turn}` : "Swipe to move. Pinch for powers."), true)}${button("kit", "Field kit", "Controls, sound & travel readiness")}</div>${foot(storageOk ? "Wrist only · No clock ticking" : saveState)}</section>`;
  } else if (screen === "mission") {
    if (run.phase === "encounter") html = encounterScreen();
    else if (run.phase === "upgrade") html = upgradeScreen();
    else if (["won", "dead"].includes(run.phase)) html = resultScreen();
    else {
      const d = DISTRICTS[run.floor],
        p = run.player,
        visible = run.enemies.filter((e) => run.visible[e.y][e.x]);
      const threat = run.enemies.some((e) =>
        e.intent.some((t) => t.x === p.x && t.y === p.y),
      );
      html = `<section class="screen mission" data-screen="mission"><div class="district-top"><p class="eyebrow">${d.tag}</p><span class="small muted">TURN <b data-turn>${run.turn}</b></span></div><div class="mission-header"><h1 class="district-name">${d.name}</h1><span class="sector number">0${run.floor + 1}<span class="muted"> / 04</span></span></div><div class="vitals"><div class="health"><span class="${p.hp <= 6 ? "red" : ""}">HULL <b>${p.hp}</b><span class="muted">/${p.maxHp}</span></span><span class="health-bar"><i style="width:${(100 * p.hp) / p.maxHp}%;${p.hp <= 6 ? "background:var(--red)" : ""}"></i></span></div><span class="gold">ATK ${p.attack}</span><span class="muted">${run.score} PTS</span></div><div class="board-row"><canvas class="map" width="396" height="396" tabindex="0" aria-label="${esc(mapDescription(run))}"></canvas><aside class="sidebar"><div class="side-label">PULSE</div><div class="pulse-dots" aria-label="${p.charges} of ${p.maxCharges} charges">${"◆".repeat(p.charges)}${"◇".repeat(p.maxCharges - p.charges)}</div><div class="small muted">Pinch for actions</div><div class="route">${DISTRICTS.map((district, i) => `<div class="route-stop ${i === run.floor ? "current" : i < run.floor ? "done" : ""}"><i></i>${district.name}</div>`).join("")}</div><div class="threat-note ${threat ? "red" : ""}">${threat ? "! Strike incoming<br>Leave marked tiles" : visible.length ? `${visible.length} hostile${visible.length > 1 ? "s" : ""} in sight` : "No hostiles<br>in sight"}</div><div class="side-bottom">◎ Landmark<br>◇ Signal<br>+ Hull kit<br>⇩ Uplink</div></aside></div><p class="mission-message ${run.event === "damage" ? "red" : ""}" role="status">${esc(run.message)}</p>${foot(`Swipe: move / attack · Pinch: actions${storageOk ? "" : " · NOT SAVED"}`)}</section>`;
      if (run.event === "pulse") app.className = "pulse-flash";
      if (run.event === "damage") app.className = "damage-flash";
    }
  } else if (screen === "loadout") html = loadoutScreen();
  else if (screen === "build") html = buildScreen();
  else if (screen === "actions") {
    html = `<section class="screen" data-screen="actions">${heading("TIME IS HELD", "Choose your next move", "The city moves only when you do.")}<div class="menu-stack tight">${button("pulse", `Discharge pulse · ${run.player.charges} left`, `${run.player.pulseDamage} damage · ${run.player.pulseRange} tiles · disrupts strikes`, true)}${button("wait", "Wait one turn", "Hold position while hostiles act")}${button("build", "Your build", "Starting kit, upgrades & synergies")}${button("return", "Return to streets", "Keep exploring")}</div>${foot("Swipe to choose · Pinch to act")}</section>`;
  } else if (screen === "kit") {
    html = `<section class="screen" data-screen="kit">${heading("EXPEDITION EQUIPMENT", "Field kit", recoveryNotice || "Pack your signal before you travel.")}<div class="menu-stack">${button("guide", "How to play", "A three-page field guide", true)}${button("sound", `Sound: ${sound ? "on" : "off"}`, "Signal score & action cues")}${button("diagnostics", "Travel readiness", "Offline cache, save & display checks")}${run && ["playing", "upgrade", "encounter"].includes(run.phase) ? button("start", "New expedition", "Leave this run and start fresh") : button("return", "Return", "Back to the city")}</div><p class="panel-foot small">Back gesture returns to the title.</p></section>`;
  } else if (screen === "guide") html = guideScreen();
  else if (screen === "diagnostics") {
    html = `<section class="screen" data-screen="diagnostics">${heading("PRE-FLIGHT CHECK", "Travel readiness")}<div class="diag"><div class="diag-row"><span>Game files</span><span data-offline>${cacheState}</span></div><div class="diag-row"><span>Run & unlocks</span><span>${saveState}</span></div><div class="diag-row"><span>Connection</span><span>${navigator.onLine ? "Online" : "Offline"}</span></div><div class="diag-row"><span>Composition</span><span>600 × 600</span></div><div class="diag-row"><span>Last map draw</span><span>${renderMs.toFixed(1)} ms</span></div><div class="diag-row"><span>Last input</span><span>${esc(lastKey)}</span></div></div><p class="diag-note">Open once on the glasses until “Offline ready”. Then disconnect, reopen, and resume a run before departure. Cache can be removed by the device.</p><div class="guide-next">${button("return", "Return", "Back to the field kit", true)}</div></section>`;
  } else if (screen === "confirm") {
    html = `<section class="screen">${heading("NEW EXPEDITION", "Leave this signal behind?", "Starting over replaces the current run.")}<div class="menu-stack">${button("return", "Keep this run", "Return without losing progress", true)}${button("restart", "Start a new run", "A different city layout awaits")}</div></section>`;
  }
  app.innerHTML = html;
  const map = app.querySelector(".map");
  if (map) {
    renderMs = drawMap(map, run);
    map.focus({ preventScroll: true });
  }
  const skyline = app.querySelector(".skyline");
  if (skyline) drawSkyline(skyline);
  const buttons = Array.from(app.querySelectorAll("button"));
  focusIndex = Math.min(focusIndex, Math.max(0, buttons.length - 1));
  buttons[focusIndex]?.focus({ preventScroll: true });
}
function upgradeScreen() {
  return `<section class="screen" data-screen="upgrade">${heading("UPLINK SECURED", `${DISTRICTS[run.floor].name} is clear`, "Install one modification. Repair 3 hull.<br>Next stop: " + DISTRICTS[run.floor + 1].name + ".")}<div class="menu-stack">${run.choices.map((id) => button(`upgrade:${id}`, UPGRADES[id].name, UPGRADES[id].text, true)).join("")}</div><p class="panel-foot">Your modifications stack for this expedition.</p>${foot()}</section>`;
}
function encounterScreen() {
  const offer = LANDMARKS[run.floor];
  return `<section class="screen" data-screen="encounter">${heading(offer.tag, offer.name, offer.text)}<p class="encounter-terms">${offer.terms}</p><p class="encounter-status" role="status">${run.message !== offer.text ? esc(run.message) : `Hull ${run.player.hp}/${run.player.maxHp} · Pulses ${run.player.charges}/${run.player.maxCharges}`}</p><div class="menu-stack">${button("encounter:take", offer.action, "Accept the tradeoff", true)}${button("encounter:leave", "Pass it by", "No reward. No cost. No extra turn.")}</div>${foot()}</section>`;
}
function resultScreen() {
  const won = run.phase === "won";
  return `<section class="screen" data-screen="${won ? "won" : "dead"}">${heading(won ? "TRANSMISSION RESTORED" : "TRANSMISSION ENDED", won ? "Good morning, San Francisco." : "Lost in the fog.")}<p class="debrief-story">${won ? "The keynote falls silent. Ferries answer the radio. For once, the future can wait." : "Your signal fades, but the route is still out there. A fresh expedition means a different city."}</p><div class="stat-grid"><div><span class="number">${run.score}</span>Signal score</div><div><span class="number">${run.turn}</span>Turns survived</div><div><span class="number">${run.kills}</span>Disconnected</div><div><span class="number">${run.floor + 1} / 4</span>District reached</div></div><p class="progress-note">${progressSummary()}</p><div class="result-actions">${button("start", "Another expedition", "New streets. New choices.", true)}${button("return", "Return", "Your best signal is saved")}</div></section>`;
}
function guideScreen() {
  const pages = [
    [
      [
        "One swipe. One turn.",
        "Swipe up, down, left or right to move. Swipe into a hostile to attack.",
      ],
      [
        "Pinch for actions",
        "Pulse hits nearby enemies and interrupts their strikes. Wait lets enemies move.",
      ],
      [
        "Put your hand down",
        "Nothing happens until your next move. Every turn is saved automatically.",
      ],
    ],
    [
      [
        "Read the warning",
        "Coral outlined tiles will be struck next turn. Move off them before attacking.",
      ],
      [
        "Different kinds of dead",
        "Husks shuffle. Runners close fast. Diamond-shaped Relays fire down streets.",
      ],
      [
        "Keep your charge",
        "A pulse disrupts enemies for two turns. Every third kill restores one charge.",
      ],
    ],
    [
      [
        "Find the uplink",
        "Explore toward the lower-right corner. The cyan gate takes you to the next district.",
      ],
      [
        "Build your expedition",
        "Ring markers offer optional landmark deals. Kits repair hull. Choose an upgrade at each uplink.",
      ],
      [
        "End the keynote",
        "At Moscone, silence the crowned Conductor, then reach the uplink to win.",
      ],
    ],
  ];
  return `<section class="screen" data-screen="guide">${heading(`FIELD GUIDE / 0${guidePage + 1} OF 03`, "Stay on the air")}<div class="guide-copy">${pages[guidePage].map(([title, body]) => `<div><h3>${title}</h3><p>${body}</p></div>`).join("")}</div><div class="guide-next">${button("next-guide", guidePage === 2 ? "Ready to go" : "Next page", guidePage === 2 ? "Return to your expedition" : "Pinch to continue", true)}</div><p class="panel-foot small">Back gesture returns without spending a turn.</p></section>`;
}
function selectLoadout() {
  progressNotice = "";
  if (screen === "title") go("loadout");
  else {
    screen = "loadout";
    focusIndex = 0;
    history.replaceState({ screen, focus: 0 }, "");
    render();
  }
}
function progressSummary() {
  return ["relay", "breaker"]
    .map((id) => KITS[id].name + ": " + unlockProgress(profile, id))
    .join(" · ");
}
function loadoutScreen() {
  return `<section class="screen" data-screen="loadout">${heading("CHOOSE YOUR STARTING KIT", "Carry a different signal", "Unlocks stay on this device. Every run counts.")}<div class="menu-stack loadouts">${Object.entries(
    KITS,
  )
    .map(([id, k]) =>
      button(
        "kit:" + id,
        k.name + (kitUnlocked(profile, id) ? "" : " · Locked"),
        k.hp +
          " hull · " +
          k.attack +
          " attack · " +
          k.charges +
          "/" +
          k.maxCharges +
          " pulses<br>" +
          (kitUnlocked(profile, id) ? k.role : unlockProgress(profile, id)),
        id === "courier",
      ),
    )
    .join(
      "",
    )}</div><p class="loadout-note" role="status">${esc(progressNotice || "Swipe to inspect. Pinch to begin. Back to cancel.")}</p>${foot(storageOk ? "Local unlocks · No account" : "Progress is not saved")}</section>`;
}
function buildScreen() {
  const k = KITS[run.kit ?? "courier"],
    p = run.player;
  return `<section class="screen" data-screen="build">${heading("TIME IS HELD", k.name + " build", k.passive)}<p class="build-stats">Attack ${p.attack} · Pulse ${p.pulseDamage} damage / ${p.pulseRange} tiles<br>Hull ${p.hp}/${p.maxHp} · Charges ${p.charges}/${p.maxCharges}</p><div class="build-mods">${run.relics.length ? run.relics.map((id) => " <div><h3>" + UPGRADES[id].name + "</h3><p>" + UPGRADES[id].text + "</p></div>").join("") : "<p>Secure an uplink to install your first modification.</p>"}</div><div class="guide-next">${button("return", "Return to actions", "No turn spent", true)}</div></section>`;
}
function start(kit) {
  if (!kitUnlocked(profile, kit)) return;
  run = newRun(crypto.getRandomValues(new Uint32Array(1))[0], kit);
  run.id = crypto.randomUUID();
  audio.play(["arrival"]);
  trackRun(profile, run);
  persist();
  if (screen === "title") go("mission");
  else {
    screen = "mission";
    focusIndex = 0;
    history.replaceState({ screen: "mission", focus: 0 }, "");
    render();
  }
}
function dispatch(action) {
  if (action.startsWith("encounter:")) {
    chooseEncounter(run, action.slice(10));
    audio.play(actionEvents(run));
    focusIndex = 0;
    persist();
    render();
    return;
  }
  if (action === "start") {
    if (run && ["playing", "upgrade", "encounter"].includes(run.phase))
      go("confirm");
    else selectLoadout();
  } else if (action === "restart") selectLoadout();
  else if (action.startsWith("kit:")) {
    const kit = action.slice(4);
    if (kitUnlocked(profile, kit)) start(kit);
    else {
      progressNotice =
        KITS[kit].name +
        ": " +
        unlockProgress(profile, kit) +
        ". Every run contributes.";
      render();
    }
  } else if (action === "build") go("build");
  else if (action === "resume") go("mission");
  else if (action === "kit") go("kit");
  else if (action === "guide") {
    guidePage = 0;
    go("guide");
  } else if (action === "next-guide") {
    if (guidePage < 2) {
      guidePage++;
      render();
    } else back();
  } else if (action === "diagnostics") go("diagnostics");
  else if (action === "sound") {
    sound = !sound;
    audio.setEnabled(sound);
    try {
      localStorage.setItem("fogfall.sound", sound ? "on" : "off");
    } catch {}
    audio.play(["arrival"]);
    render();
  } else if (action === "return") back();
  else if (action === "pulse" || action === "wait") {
    // Restore the mission entry before spending the turn, preserving shallow native Back.
    pendingAction = action;
    back();
  } else if (action.startsWith("upgrade:")) {
    chooseUpgrade(run, action.slice(8));
    focusIndex = 0;
    persist();
    audio.play(actionEvents(run));
    render();
  }
}
let pendingAction = null;
addEventListener("popstate", () => {
  if (pendingAction) {
    const action = pendingAction;
    pendingAction = null;
    settleAction(action);
  }
});
app.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) dispatch(b.dataset.action);
});
app.addEventListener("focusin", (e) => {
  const buttons = [...app.querySelectorAll("button")];
  const i = buttons.indexOf(e.target);
  if (i >= 0) focusIndex = i;
  const kit = e.target.dataset.action?.startsWith("kit:")
    ? e.target.dataset.action.slice(4)
    : null;
  if (screen === "loadout" && kit && KITS[kit]) {
    const note = app.querySelector(".loadout-note");
    if (note)
      note.textContent = progressNotice.startsWith(KITS[kit].name + ":")
        ? progressNotice
        : KITS[kit].passive;
  }
});
const filter = createInputFilter();
addEventListener(
  "keydown",
  (e) => {
    const decoded = decodeKey(e);
    if (decoded && (decoded !== "back" || screen !== "title"))
      e.preventDefault();
    const action = filter(e);
    if (!action) return;
    lastKey = `${action} (${e.keyCode || e.key})`;
    if (action === "back") {
      back();
      return;
    }
    if (screen === "mission" && run.phase === "playing") {
      if (action === "select") {
        go("actions");
        return;
      }
      settleAction(action);
      return;
    }
    const buttons = [...app.querySelectorAll("button")];
    if (action === "select") buttons[focusIndex]?.click();
    else {
      focusIndex =
        (focusIndex +
          (action === "left" || action === "up" ? -1 : 1) +
          buttons.length) %
        buttons.length;
      buttons[focusIndex]?.focus({ preventScroll: true });
      audio.play(["focus"]);
    }
  },
  true,
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    persist();
    audio.suspend();
  } else audio.resume();
});
addEventListener("pagehide", () => {
  persist();
  audio.suspend();
});
function cacheLabel(label) {
  cacheState = label;
  for (const node of app.querySelectorAll("[data-offline]"))
    node.textContent = label;
}
async function checkCache() {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  const channel = new MessageChannel();
  const timeout = setTimeout(() => cacheLabel("Offline check failed"), 5000);
  channel.port1.onmessage = (e) => {
    clearTimeout(timeout);
    cacheLabel(e.data.ready ? "Offline ready" : "Offline files missing");
    channel.port1.close();
  };
  controller.postMessage({ type: "CHECK_CACHE" }, [channel.port2]);
}
async function prepareOffline() {
  if (!("serviceWorker" in navigator)) {
    cacheLabel("Offline unavailable");
    return;
  }
  const timeout = setTimeout(
    () => cacheLabel("Cache pending · reconnect"),
    15000,
  );
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    clearTimeout(timeout);
    await checkCache();
  } catch {
    clearTimeout(timeout);
    cacheLabel("Offline unavailable");
  }
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("controllerchange", checkCache);
addEventListener("online", () => {
  checkCache();
  if (screen === "diagnostics") render();
});
addEventListener("offline", () => {
  checkCache();
  if (screen === "diagnostics") render();
});
if (run) persist();
render();
prepareOffline();
document.fonts.ready.then(() => {
  if (screen === "title") drawSkyline(app.querySelector(".skyline"));
});
