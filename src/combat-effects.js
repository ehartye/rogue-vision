const DURATION = 650;

// Presentation owns its clock. It never delays an input or changes a saved turn.
export function createCombatEffects({
  redraw,
  now = () => performance.now(),
  requestFrame = fn => requestAnimationFrame(fn),
  cancelFrame = id => cancelAnimationFrame(id),
  isHidden = () => document.hidden,
  reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches,
}) {
  let active = null, frame = null, generation = 0;
  function stop() {
    generation++;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    active = null;
  }
  function clear() {
    const painted = active !== null;
    stop();
    if (painted) redraw();
  }
  function snapshot() {
    if (!active || isHidden()) return null;
    const elapsed = now() - active.start;
    return elapsed < DURATION ? { events: active.events, reduced: active.reduced, elapsed } : null;
  }
  return {
    clear, snapshot,
    play(events) {
      stop();
      const visible = events.filter(e => e.visible);
      if (!visible.length || isHidden()) { redraw(); return; }
      active = { events: structuredClone(visible), reduced: reducedMotion(), start: now() };
      const ticket = generation;
      const tick = () => {
        if (ticket !== generation) return;
        frame = null;
        if (!snapshot()) { clear(); return; }
        redraw();
        frame = requestFrame(tick);
      };
      tick();
    },
  };
}

const centre = p => [p.x * 36 + 18, p.y * 36 + 18];
function stroke(c, points, color, width = 2) {
  c.strokeStyle = color; c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.stroke();
}
function diamond(c, x, y, radius, color) {
  stroke(c, [[x, y - radius], [x + radius, y], [x, y + radius], [x - radius, y], [x, y - radius]], color);
}
function spark(c, x, y, radius, color) {
  for (const [dx, dy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]])
    stroke(c, [[x + dx * 4, y + dy * 4], [x + dx * radius, y + dy * radius]], color);
}

export function drawCombatEffects(c, s, frame) {
  if (!frame) return;
  const { events, elapsed: ms, reduced } = frame;
  c.save();
  // Even a wide pulse or a shot crossing a corner cannot paint into the fog.
  c.beginPath();
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++)
    if (s.visible[y][x] && s.tiles[y][x] === 0) c.rect(x * 36, y * 36, 36, 36);
  c.clip();
  const numbers = new Map();
  for (const e of events) {
    if (!e.visible) continue;
    const [x, y] = centre(e.to ?? e.from);
    const color = e.kind === "damage" || e.kind === "swipe" || e.kind === "shot"
      ? "#ff827d" : e.kind === "blast" ? "#eea9ff" : "#80e8ff";
    if (e.amount > 0) {
      const key = `${e.to.x},${e.to.y}`;
      const previous = numbers.get(key);
      numbers.set(key, { x, y, amount: (previous?.amount ?? 0) + e.amount,
        color: e.kind === "damage" ? "#ff827d" : "#ffd278" });
    }
    c.globalAlpha = Math.max(0, 1 - ms / 360) * 0.85;
    if (reduced) {
      if (e.kind === "pulse") diamond(c, x, y, 12, color);
      else spark(c, x, y, 11, color);
    } else if (e.kind === "pulse" && ms < 360) {
      const radius = 8 + Math.min(ms / 300, 1) * e.range * 36;
      diamond(c, x, y, radius, color);
      diamond(c, x, y, Math.max(4, radius - 9), "#3c879d");
    } else if ((e.kind === "melee" || e.kind === "swipe") && ms < 240) {
      const [ax, ay] = centre(e.from);
      const dx = x - ax, dy = y - ay, length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length, ny = dx / length;
      stroke(c, [[ax + dx * .35 + nx * 9, ay + dy * .35 + ny * 9],
        [x + nx * 5, y + ny * 5], [x - nx * 11, y - ny * 11]], color, 3);
      spark(c, x, y, 7 + ms / 30, color);
    } else if (e.kind === "shot" && ms < 340) {
      const [ax, ay] = centre(e.from), travel = Math.min(1, ms / 190);
      const tail = Math.max(0, travel - .22);
      stroke(c, [[ax + (x - ax) * tail, ay + (y - ay) * tail],
        [ax + (x - ax) * travel, ay + (y - ay) * travel]], color, 3);
      if (ms >= 190) spark(c, x, y, 5 + (ms - 190) / 15, color);
    } else if (e.kind === "blast" && ms < 340) {
      const radius = 5 + Math.min(ms / 220, 1) * 11;
      diamond(c, x, y, radius, color);
      spark(c, x, y, radius, color);
    } else if ((e.kind === "impact" || e.kind === "damage") && ms < 280) {
      spark(c, x, y, 7 + ms / 35, color);
    }
  }
  // One number per affected square, including several enemies hitting the player.
  c.globalAlpha = Math.min(1, Math.max(0, (DURATION - ms) / 200));
  c.font = 'bold 14px Atkinson, sans-serif';
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 3;
  c.strokeStyle = "#000";
  for (const n of numbers.values()) {
    const y = n.y - 5 - (reduced ? 0 : Math.min(ms / 80, 5));
    const text = `−${n.amount}`;
    c.strokeText(text, n.x, y);
    c.fillStyle = n.color;
    c.fillText(text, n.x, y);
  }
  c.restore();
}
