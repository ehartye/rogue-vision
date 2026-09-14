import { generateDistrict, distances } from "./districts.js";
import { KITS } from "./kits.js";
export const SIZE = 11;
export const LANDMARKS = [
  {
    name: "Ferry Building",
    tag: "SEALED SUPPLY LOCKER",
    text: "A ferry crew left a field kit in a powered locker.",
    action: "Crank the locker",
    terms: "Spend 1 pulse · repair up to 7 hull",
    charges: 1,
    heal: 7,
    score: 35,
  },
  {
    name: "Dragon Gate",
    tag: "GHOST RELAY",
    text: "The lantern network can recharge your cells. Its feedback burns.",
    action: "Boost the relay",
    terms: "Lose 3 hull · up to 2 pulses + 60 points",
    hull: 3,
    cells: 2,
    score: 60,
  },
  {
    name: "Powell cable car",
    tag: "LAST SERVICE",
    text: "Supplies are on board. Opening the doors will draw runners.",
    action: "Board the car",
    terms: "Repair up to 5 hull · attract 2 runners",
    heal: 5,
    runners: 2,
    score: 40,
  },
  {
    name: "Moscone registration",
    tag: "VIP ACCESS",
    text: "A forged badge unlocks an experimental blade and repair station.",
    action: "Spoof a VIP badge",
    terms: "Spend 2 pulses · +1 attack · up to 6 hull",
    charges: 2,
    heal: 6,
    attack: 1,
    score: 75,
  },
];
export const DISTRICTS = [
  {
    name: "Embarcadero",
    tag: "THE LAST FERRY",
    story: "The ferries stopped. The fog did not. Find the uplink.",
    color: "#80e8ff",
  },
  {
    name: "Chinatown",
    tag: "GHOST CIRCUIT",
    story: "Lanterns flicker in sync. Something is listening.",
    color: "#ffd278",
  },
  {
    name: "Market Street",
    tag: "DEAD TRANSIT",
    story: "The last tram is carrying an empty crowd.",
    color: "#a1f3ce",
  },
  {
    name: "Moscone",
    tag: "THE FINAL KEYNOTE",
    story: "Dreamforce is still live. Silence the Conductor.",
    color: "#eea9ff",
  },
];
export const UPGRADES = {
  blade: {
    name: "Monofilament",
    text: "+1 attack. Cut through the crowd.",
    glyph: "blade",
  },
  shell: {
    name: "Ferry plating",
    text: "+6 maximum hull. Repair 6 hull.",
    glyph: "shield",
  },
  siphon: {
    name: "Ghost siphon",
    text: "Recover 1 hull with every kill.",
    glyph: "siphon",
  },
  arc: {
    name: "Wideband pulse",
    text: "+1 pulse range. Reach around corners.",
    glyph: "pulse",
  },
  capacitor: {
    name: "Spare cell",
    text: "+1 pulse capacity. Refill all charges.",
    glyph: "cell",
  },
  power: {
    name: "Signal amplifier",
    text: "+2 pulse damage. Clear the swarm.",
    glyph: "signal",
  },
  aftershock: {
    name: "Aftershock blade",
    text: "+3 melee damage against disrupted hostiles.",
    glyph: "blade",
  },
  kinetic: {
    name: "Kinetic recovery",
    text: "+1 charge every second melee strike.",
    glyph: "cell",
  },
};
export const ENEMIES = {
  husk: { name: "Husk", hp: 5, damage: 2, score: 15 },
  runner: { name: "Runner", hp: 3, damage: 2, score: 20 },
  spitter: { name: "Relay", hp: 4, damage: 3, score: 25 },
  conductor: { name: "Conductor", hp: 20, damage: 4, score: 150 },
};
const vectors = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const same = (a, b) => a.x === b.x && a.y === b.y;
function random(s) {
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function shuffle(s, items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function buildFloor(s) {
  Object.assign(
    s,
    generateDistrict(s.floor, () => random(s)),
  );
  s.player.x = 1;
  s.player.y = 1;
  s.exit = { x: 9, y: 9 };
  const cells = [];
  for (let y = 1; y < 10; y++)
    for (let x = 1; x < 10; x++)
      if (
        s.tiles[y][x] === 0 &&
        x + y > 5 &&
        !(x === 9 && y === 9) &&
        !same({ x, y }, s.landmark)
      )
        cells.push({ x, y });
  shuffle(s, cells);
  s.enemies = [];
  s.items = [];
  for (let i = 0; i < 4 + s.floor; i++) {
    const kind =
      i === 0 && s.floor === 3
        ? "conductor"
        : i % 3 === 2 && s.floor > 0
          ? "spitter"
          : i % 3 === 1
            ? "runner"
            : "husk";
    const hp = ENEMIES[kind].hp;
    s.enemies.push({
      ...cells.pop(),
      id: i,
      kind,
      hp,
      maxHp: hp,
      intent: [],
      stun: 0,
    });
  }
  const fromStart = distances(s.tiles, { x: 1, y: 1 }),
    fromExit = distances(s.tiles, s.exit);
  // Put a supply on an optional side route; shuffled ties keep locations varied.
  cells.sort(
    (a, b) =>
      fromStart.get(`${a.x},${a.y}`) +
      fromExit.get(`${a.x},${a.y}`) -
      (fromStart.get(`${b.x},${b.y}`) + fromExit.get(`${b.x},${b.y}`)),
  );
  for (const kind of ["med", "cell", "signal", "med", "signal"])
    s.items.push({ ...cells.pop(), kind });
  s.seen = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  s.visible = [];
  s.phase = "playing";
  s.message = DISTRICTS[s.floor].story;
  s.event = "arrival";
  reveal(s);
}
export function newRun(seed = Date.now() >>> 0, kit = "courier") {
  if (!Object.hasOwn(KITS, kit)) throw Error("Unknown starting kit");
  const loadout = KITS[kit];
  const s = {
    version: 1,
    kit,
    meleeHits: 0,
    seed: seed >>> 0,
    rng: seed >>> 0,
    floor: 0,
    turn: 0,
    kills: 0,
    score: 0,
    phase: "playing",
    relics: [],
    choices: [],
    player: {
      x: 1,
      y: 1,
      hp: loadout.hp,
      maxHp: loadout.hp,
      attack: loadout.attack,
      charges: loadout.charges,
      maxCharges: loadout.maxCharges,
      pulseDamage: loadout.pulseDamage,
      pulseRange: 2,
      siphon: 0,
    },
    message: "",
    event: "arrival",
  };
  buildFloor(s);
  return s;
}
function lineClear(s, a, b) {
  let x = a.x,
    y = a.y;
  const dx = Math.abs(b.x - x),
    dy = Math.abs(b.y - y),
    sx = x < b.x ? 1 : -1,
    sy = y < b.y ? 1 : -1;
  let error = dx - dy;
  while (x !== b.x || y !== b.y) {
    const e = error * 2;
    if (e > -dy) {
      error -= dy;
      x += sx;
    }
    if (e < dx) {
      error += dx;
      y += sy;
    }
    if (x === b.x && y === b.y) return true;
    if (s.tiles[y]?.[x] !== 0) return false;
  }
  return true;
}
export function reveal(s) {
  s.visible = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (distance(s.player, { x, y }) <= 5 && lineClear(s, s.player, { x, y }))
        s.visible[y][x] = s.seen[y][x] = true;
}
// Per-action outcomes are transient: visual feedback retains its single event,
// while consumers can observe simultaneous results without changing saved runs.
const outcomes = new WeakMap();
export function actionEvents(s) {
  return [...(outcomes.get(s) ?? [])];
}
function emit(s, event) {
  if (!outcomes.has(s)) outcomes.set(s, new Set());
  outcomes.get(s).add(event);
}
function threatened(s) {
  return s.enemies.some((e) => e.intent.some((p) => same(p, s.player)));
}
function removeDead(s) {
  const dead = s.enemies.filter((e) => e.hp <= 0);
  for (const e of dead) {
    s.kills++;
    s.score += ENEMIES[e.kind].score;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.siphon);
    if (s.kills % 3 === 0)
      s.player.charges = Math.min(s.player.maxCharges, s.player.charges + 1);
    s.message =
      e.kind === "conductor"
        ? "The keynote is silent. Reach the uplink."
        : `${ENEMIES[e.kind].name} disconnected.`;
    s.event = "kill";
    emit(s, "kill");
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  return dead.length;
}
function enemyTurn(s) {
  for (const e of s.enemies) {
    if (e.stun > 0) {
      e.stun--;
      e.intent = [];
      continue;
    }
    if (e.intent.length) {
      if (e.intent.some((p) => same(p, s.player))) {
        s.player.hp = Math.max(0, s.player.hp - ENEMIES[e.kind].damage);
        s.message = `${ENEMIES[e.kind].name} hit for ${ENEMIES[e.kind].damage}. Move off marked tiles.`;
        s.event = "damage";
        emit(s, "damage");
      }
      e.intent = [];
      continue;
    }
    const dist = distance(e, s.player);
    if (dist > 6) continue;
    if (dist === 1) {
      e.intent = [{ x: s.player.x, y: s.player.y }];
      continue;
    }
    if (e.kind === "conductor" && dist <= 4) {
      const horizontal = s.turn % 2 === 0;
      e.intent = [-1, 0, 1]
        .map((offset) => ({
          x: s.player.x + (horizontal ? offset : 0),
          y: s.player.y + (horizontal ? 0 : offset),
        }))
        .filter((p) => s.tiles[p.y]?.[p.x] === 0);
      s.message = "Conductor charging. Leave the marked line.";
      continue;
    }
    if (
      e.kind === "spitter" &&
      dist <= 4 &&
      (e.x === s.player.x || e.y === s.player.y) &&
      lineClear(s, e, s.player)
    ) {
      e.intent = [{ x: s.player.x, y: s.player.y }];
      continue;
    }
    if (e.kind === "husk" && s.turn % 2 === 0) continue;
    // Shortest-path step respects walls and other actors; deterministic tie-breaking.
    const queue = [{ x: e.x, y: e.y, first: null }],
      seen = new Set([`${e.x},${e.y}`]);
    let next = null;
    for (const p of queue) {
      if (same(p, s.player)) {
        next = p.first;
        break;
      }
      for (const [dx, dy] of Object.values(vectors)) {
        const n = { x: p.x + dx, y: p.y + dy },
          key = `${n.x},${n.y}`;
        if (
          s.tiles[n.y]?.[n.x] !== 0 ||
          seen.has(key) ||
          s.enemies.some((other) => other !== e && same(other, n))
        )
          continue;
        seen.add(key);
        queue.push({ ...n, first: p.first ?? n });
      }
    }
    if (next && !same(next, s.player)) {
      e.x = next.x;
      e.y = next.y;
    }
  }
  if (s.player.hp === 0) {
    s.phase = "dead";
    s.message = "Your signal is lost. The city remembers.";
    s.event = "dead";
    emit(s, "dead");
  }
}
export function act(s, action) {
  outcomes.set(s, new Set());
  if (s.phase !== "playing") return false;
  const wasThreatened = threatened(s);
  let melee = false;
  s.event = "move";
  if (vectors[action]) {
    const [dx, dy] = vectors[action],
      to = { x: s.player.x + dx, y: s.player.y + dy };
    if (s.tiles[to.y]?.[to.x] !== 0) {
      s.message = "Blocked. No turn spent.";
      s.event = "blocked";
      emit(s, "blocked");
      return false;
    }
    const enemy = s.enemies.find((e) => same(e, to));
    if (enemy) {
      melee = true;
      const damage =
        s.player.attack +
        (enemy.stun > 0
          ? 3 * s.relics.filter((r) => r === "aftershock").length
          : 0);
      enemy.hp -= damage;
      s.meleeHits = (s.meleeHits ?? 0) + 1;
      if (s.meleeHits % 2 === 0)
        s.player.charges = Math.min(
          s.player.maxCharges,
          s.player.charges + s.relics.filter((r) => r === "kinetic").length,
        );
      s.message = `${ENEMIES[enemy.kind].name} −${damage} hull.`;
      s.event = "hit";
    } else {
      Object.assign(s.player, to);
      s.message = "Sweep the streets. Reach the uplink.";
    }
  } else if (action === "pulse") {
    if (s.player.charges === 0) {
      s.message = "No charge. Every third kill restores one.";
      s.event = "blocked";
      emit(s, "blocked");
      return false;
    }
    s.player.charges--;
    s.event = "pulse";
    s.message = "Pulse released. Nearby hostiles disrupted.";
    for (const e of s.enemies)
      if (distance(e, s.player) <= s.player.pulseRange) {
        e.hp -= s.player.pulseDamage;
        e.stun = 2;
        e.intent = [];
      }
  } else if (action === "wait") {
    s.message = "Holding position.";
    s.event = "wait";
  } else return false;
  emit(s, s.event);
  s.turn++;
  const killed = removeDead(s);
  if (s.kit === "relay" && action === "pulse" && killed >= 2)
    s.player.charges = Math.min(s.player.maxCharges, s.player.charges + 1);
  if (s.kit === "breaker" && melee && killed)
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + killed);
  const item = s.items.find((i) => same(i, s.player));
  if (item) {
    if (item.kind === "med") {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 5);
      s.message = "Field kit: +5 hull.";
    }
    if (item.kind === "cell") {
      s.player.charges = Math.min(s.player.maxCharges, s.player.charges + 1);
      s.message = "Power cell: +1 pulse.";
    }
    if (item.kind === "signal") {
      s.score += 30;
      s.message = "Clean signal recovered. +30 score.";
    }
    s.items = s.items.filter((i) => i !== item);
    s.event = "pickup";
    emit(s, "pickup");
  }
  if (
    same(s.player, s.exit) &&
    !(s.floor === 3 && s.enemies.some((e) => e.kind === "conductor"))
  ) {
    s.score += 100;
    if (s.floor === DISTRICTS.length - 1) {
      s.phase = "won";
      emit(s, "won");
      s.message = "San Francisco is back on the air.";
      s.score += s.player.hp * 10;
    } else {
      s.phase = "upgrade";
      emit(s, "uplink");
      s.choices = shuffle(s, Object.keys(UPGRADES)).slice(0, 3);
      s.message = "Uplink secured. Choose your next modification.";
    }
    reveal(s);
    return true;
  }
  if (same(s.player, s.exit))
    s.message = "Uplink jammed. Silence the Conductor first.";
  enemyTurn(s);
  if (s.phase === "playing" && !wasThreatened && threatened(s))
    emit(s, "warning");
  if (
    s.phase === "playing" &&
    s.landmark &&
    !s.landmark.resolved &&
    same(s.player, s.landmark)
  ) {
    s.phase = "encounter";
    emit(s, "landmark");
    s.message = LANDMARKS[s.floor].text;
  }
  reveal(s);
  return true;
}
export function chooseEncounter(s, choice) {
  outcomes.set(s, new Set());
  if (
    s.phase !== "encounter" ||
    !s.landmark ||
    s.landmark.resolved ||
    !["take", "leave"].includes(choice)
  )
    return false;
  const offer = LANDMARKS[s.floor],
    p = s.player;
  if (choice === "take") {
    if (p.charges < (offer.charges ?? 0) || p.hp <= (offer.hull ?? 0)) {
      s.message = "Not enough resources. You can pass by safely.";
      emit(s, "blocked");
      return false;
    }
    p.charges = Math.min(
      p.maxCharges,
      p.charges - (offer.charges ?? 0) + (offer.cells ?? 0),
    );
    p.hp = Math.min(p.maxHp, p.hp - (offer.hull ?? 0) + (offer.heal ?? 0));
    p.attack += offer.attack ?? 0;
    s.score += offer.score;
    if (offer.runners) {
      const cells = [];
      for (let y = 1; y < 10; y++)
        for (let x = 1; x < 10; x++) {
          const cell = { x, y },
            d = distance(cell, p);
          if (
            s.tiles[y][x] === 0 &&
            d >= 3 &&
            !same(cell, s.exit) &&
            !s.enemies.some((e) => same(e, cell)) &&
            !s.items.some((e) => same(e, cell))
          )
            cells.push(cell);
        }
      cells.sort((a, b) => distance(a, p) - distance(b, p));
      for (const cell of cells.slice(0, offer.runners))
        s.enemies.push({
          ...cell,
          id: Math.max(-1, ...s.enemies.map((e) => e.id)) + 1,
          kind: "runner",
          hp: 3,
          maxHp: 3,
          stun: 0,
          intent: [],
        });
    }
    s.message = offer.runners
      ? "Supplies secured. Two runners heard the doors."
      : `${offer.name}: supplies secured.`;
  } else s.message = "You leave the landmark untouched.";
  s.landmark.resolved = true;
  s.landmark.outcome = choice;
  s.phase = "playing";
  s.event = "pickup";
  emit(s, choice === "take" ? "trade" : "leave");
  reveal(s);
  return true;
}
export function chooseUpgrade(s, id) {
  outcomes.set(s, new Set());
  if (s.phase !== "upgrade" || !s.choices.includes(id)) return false;
  const p = s.player;
  if (id === "blade") p.attack++;
  if (id === "shell") {
    p.maxHp += 6;
    p.hp = Math.min(p.maxHp, p.hp + 6);
  }
  if (id === "siphon") p.siphon++;
  if (id === "arc") p.pulseRange++;
  if (id === "capacitor") {
    p.maxCharges++;
    p.charges = p.maxCharges;
  }
  if (id === "power") p.pulseDamage += 2;
  p.hp = Math.min(p.maxHp, p.hp + 3);
  p.charges = Math.min(p.maxCharges, p.charges + 1);
  s.relics.push(id);
  s.floor++;
  s.choices = [];
  buildFloor(s);
  emit(s, "arrival");
  return true;
}
export const encodeSave = (s) => JSON.stringify({ version: 1, state: s });
export function decodeSave(raw) {
  try {
    const envelope = JSON.parse(raw),
      s = envelope.state;
    if (envelope.version !== 1 || !s || s.version !== 1) return null;
    const integer = (v, min, max) =>
      Number.isInteger(v) && v >= min && v <= max;
    const pos = (p) => p && integer(p.x, 0, 10) && integer(p.y, 0, 10);
    if (
      (s.kit !== undefined && !Object.hasOwn(KITS, s.kit)) ||
      (s.meleeHits !== undefined && !integer(s.meleeHits, 0, 1000000)) ||
      (s.id !== undefined &&
        (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 100))
    )
      return null;
    const grid = (g, predicate) =>
      Array.isArray(g) &&
      g.length === 11 &&
      g.every(
        (row) =>
          Array.isArray(row) && row.length === 11 && row.every(predicate),
      );
    if (
      !integer(s.seed, 0, 0xffffffff) ||
      !integer(s.rng, 0, 0xffffffff) ||
      !integer(s.floor, 0, 3) ||
      !integer(s.turn, 0, 1000000) ||
      !integer(s.kills, 0, 100000) ||
      !integer(s.score, 0, 10000000)
    )
      return null;
    if (
      !["playing", "upgrade", "encounter", "dead", "won"].includes(s.phase) ||
      !grid(s.tiles, (v) => v === 0 || v === 1) ||
      !grid(s.seen, (v) => typeof v === "boolean") ||
      !grid(s.visible, (v) => typeof v === "boolean")
    )
      return null;
    const p = s.player;
    if (
      s.landmark !== undefined &&
      (!pos(s.landmark) ||
        typeof s.landmark.resolved !== "boolean" ||
        s.tiles[s.landmark.y]?.[s.landmark.x] !== 0)
    )
      return null;
    if (
      s.phase === "encounter" &&
      (!s.landmark || s.landmark.resolved || !same(p, s.landmark))
    )
      return null;
    if (
      !pos(p) ||
      s.tiles[p.y][p.x] !== 0 ||
      !pos(s.exit) ||
      s.tiles[s.exit.y][s.exit.x] !== 0
    )
      return null;
    if (
      !integer(p.maxHp, 1, 100) ||
      !integer(p.hp, 0, p.maxHp) ||
      !integer(p.attack, 1, 20) ||
      !integer(p.maxCharges, 1, 10) ||
      !integer(p.charges, 0, p.maxCharges) ||
      !integer(p.pulseDamage, 1, 20) ||
      !integer(p.pulseRange, 1, 8) ||
      !integer(p.siphon, 0, 4)
    )
      return null;
    if (
      !Array.isArray(s.enemies) ||
      s.enemies.length > 20 ||
      !s.enemies.every(
        (e) =>
          pos(e) &&
          Object.hasOwn(ENEMIES, e.kind) &&
          integer(e.hp, 1, 100) &&
          integer(e.maxHp, e.hp, 100) &&
          integer(e.stun, 0, 2) &&
          Array.isArray(e.intent) &&
          e.intent.length <= 5 &&
          e.intent.every(pos),
      )
    )
      return null;
    if (
      !Array.isArray(s.items) ||
      s.items.length > 20 ||
      !s.items.every(
        (i) => pos(i) && ["med", "cell", "signal"].includes(i.kind),
      )
    )
      return null;
    if (
      !Array.isArray(s.relics) ||
      s.relics.length > 3 ||
      !s.relics.every((r) => Object.hasOwn(UPGRADES, r)) ||
      !Array.isArray(s.choices) ||
      !s.choices.every((r) => Object.hasOwn(UPGRADES, r))
    )
      return null;
    if (s.phase === "upgrade" && (s.choices.length !== 3 || s.floor === 3))
      return null;
    if (
      (s.phase === "dead") !== (p.hp === 0) ||
      typeof s.message !== "string" ||
      s.message.length > 300 ||
      typeof s.event !== "string"
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
