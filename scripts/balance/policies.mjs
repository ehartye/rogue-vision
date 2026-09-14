import { LANDMARKS } from "../../src/game.js";

export const POLICY_VERSION = 2;
export const POLICIES = ["direct", "scavenger", "tactical"];
const moves = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const key = (p) => `${p.x},${p.y}`;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Match the rendered map: remembered terrain, currently visible actors/items
// and marked visible tiles (even when the actor itself is out of sight).
export function observe(s) {
  return structuredClone({
    floor: s.floor,
    phase: s.phase,
    turn: s.turn,
    kit: s.kit,
    player: s.player,
    relics: s.relics,
    choices: s.choices,
    tiles: s.tiles.map((row, y) =>
      row.map((tile, x) => (s.seen[y][x] ? tile : null)),
    ),
    visible: s.visible,
    enemies: s.enemies
      .filter((e) => s.visible[e.y][e.x])
      .map((e) => ({
        ...e,
        intent: e.intent.filter((p) => s.visible[p.y][p.x]),
      })),
    threats: s.enemies.flatMap((e) =>
      e.intent
        .filter((p) => s.visible[p.y][p.x])
        .map((p) => ({ ...p, source: s.visible[e.y][e.x] ? e.id : null })),
    ),
    items: s.items.filter((i) => s.visible[i.y][i.x]),
    exit: { x: 9, y: 9 }, // Stated in the accessible map description.
    relay: s.relay ?? null, // Public objective beacon, like the uplink.
    landmark:
      s.landmark && s.seen[s.landmark.y][s.landmark.x] ? s.landmark : null,
  });
}

export function newMemory(seed) {
  return {
    rng: seed >>> 0,
    floor: -1,
    visits: {},
    items: {},
    bossDefeated: false,
  };
}

function routes(o) {
  const result = new Map([
    [key(o.player), { ...o.player, steps: 0, first: "wait" }],
  ]);
  for (const p of result.values()) {
    for (const [action, [dx, dy]] of Object.entries(moves)) {
      const next = {
        x: p.x + dx,
        y: p.y + dy,
        steps: p.steps + 1,
        first: p.steps ? p.first : action,
      };
      if (o.tiles[next.y]?.[next.x] !== 0 || result.has(key(next))) continue;
      result.set(key(next), next);
    }
  }
  return result;
}

function upgrade(o, policy) {
  const order =
    policy === "direct"
      ? [
          "blade",
          "power",
          "shell",
          "capacitor",
          "siphon",
          "kinetic",
          "aftershock",
          "arc",
        ]
      : o.kit === "relay"
        ? [
            "power",
            "capacitor",
            "arc",
            "kinetic",
            "shell",
            "siphon",
            "blade",
            "aftershock",
          ]
        : [
            "blade",
            "siphon",
            "kinetic",
            "power",
            "shell",
            "aftershock",
            "capacitor",
            "arc",
          ];
  if (o.player.hp < o.player.maxHp / 2 && o.choices.includes("shell"))
    return "shell";
  return order.find((id) => o.choices.includes(id));
}

export function decide(o, memory, policy) {
  if (!POLICIES.includes(policy)) throw Error(`Unknown policy: ${policy}`);
  if (o.phase === "upgrade") return `upgrade:${upgrade(o, policy)}`;
  if (o.phase === "encounter") {
    const offer = LANDMARKS[o.floor],
      p = o.player;
    const affordable =
      p.charges >= (offer.charges ?? 0) && p.hp > (offer.hull ?? 0);
    const useful =
      (p.maxHp - p.hp >= 3 && offer.heal) ||
      (p.maxCharges - p.charges >= 2 && offer.cells) ||
      offer.attack;
    return `encounter:${policy !== "direct" && affordable && useful ? "take" : "leave"}`;
  }
  if (o.phase !== "playing") return null;
  if (memory.floor !== o.floor) {
    Object.assign(memory, {
      floor: o.floor,
      visits: {},
      items: {},
      bossDefeated: false,
    });
  }
  memory.visits[key(o.player)] = (memory.visits[key(o.player)] ?? 0) + 1;
  for (const [position, item] of Object.entries(memory.items)) {
    if (o.visible[item.y][item.x] && !o.items.some((i) => key(i) === position))
      delete memory.items[position];
  }
  for (const item of o.items) memory.items[key(item)] = item;
  const paths = routes(o),
    objectives = [];
  const relay = o.relay?.progress < 3 ? o.relay : null;
  const destination = relay ?? o.exit;
  if (relay && paths.has(key(relay)))
    objectives.push({ ...paths.get(key(relay)), value: 35 });
  for (const p of paths.values()) {
    if (
      p.steps &&
      Object.values(moves).some(
        ([dx, dy]) => o.tiles[p.y + dy]?.[p.x + dx] === null,
      )
    ) {
      objectives.push({
        ...p,
        value:
          14 -
          p.steps -
          distance(p, destination) * 0.25 -
          (memory.visits[key(p)] ?? 0) * 4,
      });
    }
  }
  const boss = o.enemies.find((e) => e.kind === "conductor");
  if (boss && paths.has(key(boss)))
    objectives.push({ ...paths.get(key(boss)), value: 30 });
  if (!relay && (o.floor < 3 || memory.bossDefeated || !objectives.length)) {
    const exit = paths.get(key(o.exit));
    if (exit?.steps) objectives.push({ ...exit, value: 20 - exit.steps * 0.3 });
  }
  if (policy !== "direct") {
    for (const item of Object.values(memory.items)) {
      const p = paths.get(key(item));
      if (!p?.steps) continue;
      const useful =
        item.kind === "med"
          ? Math.min(5, o.player.maxHp - o.player.hp) * 3
          : item.kind === "cell"
            ? o.player.charges < o.player.maxCharges
              ? 12
              : 0
            : policy === "scavenger"
              ? 9
              : 0;
      if (useful) objectives.push({ ...p, value: 20 + useful - p.steps * 1.5 });
    }
    if (o.landmark && !o.landmark.resolved) {
      const p = paths.get(key(o.landmark)),
        offer = LANDMARKS[o.floor];
      const useful =
        (o.player.maxHp - o.player.hp >= 4 && offer.heal) ||
        (offer.attack && o.player.charges >= 2) ||
        (offer.cells &&
          o.player.maxCharges - o.player.charges >= 2 &&
          o.player.hp > 6);
      if (p?.steps && useful) objectives.push({ ...p, value: 25 - p.steps });
    }
  }
  objectives.sort((a, b) => b.value - a.value);
  const target = objectives[0];
  const candidates = Object.entries(moves)
    .filter(([, [dx, dy]]) => o.tiles[o.player.y + dy]?.[o.player.x + dx] === 0)
    .map(([action]) => action);
  candidates.push("wait");
  if (
    o.player.charges > 0 &&
    (o.enemies.some((e) => distance(e, o.player) <= o.player.pulseRange) ||
      (relay && distance(relay, o.player) <= o.player.pulseRange))
  )
    candidates.push("pulse");
  // A separate, replayable RNG breaks ties; it never advances world generation.
  memory.rng = (Math.imul(1664525, memory.rng) + 1013904223) >>> 0;
  const offset = memory.rng % candidates.length;
  const ordered = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  let best;
  for (const action of ordered) {
    const delta = moves[action],
      destination = delta
        ? { x: o.player.x + delta[0], y: o.player.y + delta[1] }
        : o.player;
    const enemy = o.enemies.find((e) => key(e) === key(destination));
    const position = enemy ? o.player : destination;
    const damage =
      o.player.attack +
      (enemy?.stun > 0
        ? 3 * o.relics.filter((r) => r === "aftershock").length
        : 0);
    const affected =
      action === "pulse"
        ? o.enemies.filter((e) => distance(e, o.player) <= o.player.pulseRange)
        : enemy
          ? [enemy]
          : [];
    const killed = affected.filter(
      (e) => e.hp <= (action === "pulse" ? o.player.pulseDamage : damage),
    );
    const cancelled = action === "pulse" ? affected : killed;
    const danger = o.threats.some(
      (p) =>
        key(p) === key(position) && !cancelled.some((e) => e.id === p.source),
    );
    let value = target
      ? (distance(o.player, target) - distance(position, target)) * 3
      : 0;
    if (action === target?.first) value += 8;
    value -= (memory.visits[key(position)] ?? 0) * 0.5;
    if (action === "wait") value -= 5;
    if (relay && key(position) === key(relay)) value += 14;
    if (
      relay &&
      action === "pulse" &&
      distance(relay, o.player) <= o.player.pulseRange
    )
      // Value only the work remaining. A flat completion bonus made bots burn
      // a charge even when one safe manual turn would finish the relay.
      value += (policy === "direct" ? 6 : 3) * (3 - relay.progress);
    if (danger) value -= policy === "direct" ? 12 : 60;
    if (enemy)
      value += (killed.length ? 10 : 3) + (enemy.kind === "conductor" ? 5 : 0);
    if (action === "pulse")
      value +=
        affected.length * 4 + killed.length * 5 - (policy === "direct" ? 9 : 6);
    if (!best || value > best.value) best = { action, value, killed };
  }
  if (best?.killed.some((e) => e.kind === "conductor"))
    memory.bossDefeated = true;
  return best?.action ?? null;
}
