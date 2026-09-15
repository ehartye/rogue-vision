import { DISTRICTS } from "./game.js";
import { artReady, drawSprite } from "./art.js";
import { drawScenery } from "./scenery.js";
import { drawFerryBuilding } from "./waterfront.js";
import { drawCableCar } from "./transit.js";
import { drawMoscone } from "./moscone.js";
const C = {
  ice: "#80e8ff",
  white: "#effcff",
  gold: "#ffd278",
  red: "#ff827d",
  green: "#a1f3ce",
  dim: "#315561",
};
function line(ctx, points, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
export function drawSkyline(canvas, won = false) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 600, 180);
  c.strokeStyle = won ? C.gold : C.ice;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(302, 88, 76, -Math.PI * 0.83, Math.PI * 0.65);
  c.stroke();
  c.strokeStyle = C.dim;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(302, 88, 64, Math.PI * 0.22, Math.PI * 1.66);
  c.stroke();
  // Bay Bridge, Ferry Building clock tower, Transamerica and Salesforce Tower.
  line(
    c,
    [
      [4, 144],
      [26, 126],
      [26, 78],
      [30, 78],
      [30, 127],
      [94, 150],
      [136, 149],
    ],
    C.dim,
    3,
  );
  for (let x = 36; x < 95; x += 12)
    line(
      c,
      [
        [x, 130 + (x - 36) * 0.32],
        [x, 156],
      ],
      C.dim,
    );
  c.fillStyle = "#000";
  c.beginPath();
  c.moveTo(100, 163);
  const roof = [
    [100, 136],
    [126, 136],
    [126, 121],
    [150, 121],
    [150, 98],
    [158, 98],
    [158, 77],
    [167, 77],
    [167, 58],
    [170, 49],
    [173, 58],
    [173, 77],
    [182, 77],
    [182, 98],
    [190, 98],
    [190, 135],
    [218, 135],
    [218, 111],
    [230, 111],
    [244, 41],
    [250, 18],
    [256, 42],
    [270, 119],
    [279, 119],
    [279, 145],
    [306, 145],
    [306, 118],
    [329, 118],
    [329, 66],
    [333, 53],
    [340, 42],
    [353, 38],
    [366, 42],
    [373, 53],
    [377, 67],
    [377, 132],
    [397, 132],
    [397, 109],
    [417, 109],
    [417, 95],
    [424, 95],
    [424, 109],
    [442, 109],
    [442, 139],
    [470, 139],
    [470, 123],
    [500, 123],
    [500, 150],
    [544, 150],
    [554, 163],
  ];
  for (const [x, y] of roof) c.lineTo(x, y);
  c.lineTo(554, 180);
  c.lineTo(100, 180);
  c.closePath();
  c.fill();
  line(c, roof, C.ice, 3);
  line(
    c,
    [
      [247, 52],
      [247, 141],
    ],
    C.dim,
  );
  line(
    c,
    [
      [356, 47],
      [356, 157],
    ],
    C.dim,
  );
  c.strokeStyle = C.gold;
  c.beginPath();
  c.arc(170, 89, 5, 0, Math.PI * 2);
  c.stroke();
  for (let y = 73; y < 133; y += 14)
    line(
      c,
      [
        [338, y],
        [368, y],
      ],
      C.dim,
    );
  line(
    c,
    [
      [0, 164],
      [157, 164],
      [178, 169],
      [386, 169],
      [410, 164],
      [600, 164],
    ],
    C.ice,
  );
  line(
    c,
    [
      [68, 177],
      [192, 177],
    ],
    C.dim,
  );
  line(
    c,
    [
      [412, 178],
      [552, 178],
    ],
    C.dim,
  );
  c.fillStyle = C.gold;
  c.fillRect(296, 7, 12, 5);
  c.fillRect(298, 4, 8, 11);
}
export function drawMap(canvas, s) {
  const start = performance.now(),
    c = canvas.getContext("2d");
  c.clearRect(0, 0, 396, 396);
  canvas.dataset.art = artReady() ? "ready" : "fallback";
  c.lineCap = "square";
  const threats = new Set(
    s.enemies.flatMap((e) => e.intent.map((p) => `${p.x},${p.y}`)),
  );
  drawScenery(c, s);
  const landmarkDrawn = drawFerryBuilding(c, s) || drawCableCar(c, s) || drawMoscone(c, s);
  const gateDrawn =
    s.floor === 1 &&
    s.landmark &&
    s.seen[s.landmark.y][s.landmark.x] &&
    drawSprite(
      c,
      "dragon-gate",
      s.landmark.x * 36,
      s.landmark.y * 36,
      s.landmark.resolved
        ? 0.4
        : s.visible[s.landmark.y][s.landmark.x]
          ? 1
          : 0.5,
    );
  if (s.landmark && !s.landmark.resolved && !gateDrawn && !landmarkDrawn) {
    const x = s.landmark.x * 36 + 18,
      y = s.landmark.y * 36 + 18;
    c.strokeStyle = C.gold;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, 11, 0, Math.PI * 2);
    c.stroke();
    line(
      c,
      [
        [x - 4, y],
        [x + 4, y],
      ],
      C.gold,
      3,
    );
    line(
      c,
      [
        [x, y - 4],
        [x, y + 4],
      ],
      C.gold,
      3,
    );
  }
  if (s.seen[s.exit.y][s.exit.x]) {
    const x = s.exit.x * 36,
      y = s.exit.y * 36;
    line(
      c,
      [
        [x + 5, y + 27],
        [x + 5, y + 7],
        [x + 30, y + 7],
        [x + 30, y + 27],
      ],
      C.ice,
      3,
    );
    line(
      c,
      [
        [x + 12, y + 20],
        [x + 18, y + 26],
        [x + 25, y + 19],
      ],
      C.ice,
      3,
    );
    if (s.relay?.progress < 3) {
      c.fillStyle = C.gold;
      c.fillRect(x + 14, y + 11, 8, 3);
    }
  }
  if (s.relay) {
    const x = s.relay.x * 36,
      y = s.relay.y * 36,
      online = s.relay.progress === 3;
    // Public objective beacon, drawn without revealing surrounding terrain.
    c.strokeStyle = online ? C.green : C.gold;
    c.lineWidth = 2;
    c.strokeRect(x + 9, y + 10, 18, 16);
    c.fillStyle = online ? C.green : C.gold;
    c.fillRect(x + 16, y + 5, 4, 4);
    c.fillRect(x + 16, y + 27, 4, 3);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i < s.relay.progress ? C.green : C.dim;
      c.fillRect(x + 12 + i * 5, y + 15, 3, 7);
    }
  }
  for (const item of s.items)
    if (s.visible[item.y][item.x]) {
      const x = item.x * 36 + 18,
        y = item.y * 36 + 18;
      c.strokeStyle = item.kind === "med" ? C.green : C.gold;
      c.lineWidth = 3;
      if (item.kind === "med") {
        c.strokeRect(x - 10, y - 10, 20, 20);
        line(
          c,
          [
            [x - 5, y],
            [x + 5, y],
          ],
          C.green,
          3,
        );
        line(
          c,
          [
            [x, y - 5],
            [x, y + 5],
          ],
          C.green,
          3,
        );
      } else if (item.kind === "cell") {
        c.strokeRect(x - 7, y - 10, 14, 20);
        c.fillStyle = C.gold;
        c.fillRect(x - 3, y - 6, 6, 12);
      } else {
        line(
          c,
          [
            [x, y - 11],
            [x + 9, y],
            [x, y + 11],
            [x - 9, y],
            [x, y - 11],
          ],
          C.gold,
          3,
        );
      }
    }
  for (const e of s.enemies)
    if (s.visible[e.y][e.x]) {
      const x = e.x * 36 + 18,
        y = e.y * 36 + 18;
      c.strokeStyle = C.red;
      c.fillStyle = C.red;
      c.lineWidth = 3;
      if (
        drawSprite(
          c,
          e.kind === "spitter" ? "relay" : e.kind,
          e.x * 36,
          e.y * 36,
        )
      ) {
        // Status marks below remain shared with the vector fallback.
      } else if (e.kind === "runner") {
        line(
          c,
          [
            [x - 11, y - 9],
            [x, y],
            [x - 11, y + 9],
          ],
          C.red,
          4,
        );
        line(
          c,
          [
            [x + 1, y - 9],
            [x + 11, y],
            [x + 1, y + 9],
          ],
          C.red,
          3,
        );
      } else if (e.kind === "spitter") {
        line(
          c,
          [
            [x, y - 12],
            [x + 11, y],
            [x, y + 11],
            [x - 11, y],
            [x, y - 12],
          ],
          C.red,
          3,
        );
        c.fillRect(x - 3, y - 3, 6, 6);
      } else if (e.kind === "conductor") {
        line(
          c,
          [
            [x - 12, y + 9],
            [x - 12, y - 8],
            [x - 5, y - 3],
            [x, y - 13],
            [x + 5, y - 3],
            [x + 12, y - 8],
            [x + 12, y + 9],
            [x - 12, y + 9],
          ],
          "#eea9ff",
          3,
        );
        c.fillStyle = "#eea9ff";
        c.fillRect(x - 7, y + 1, 4, 4);
        c.fillRect(x + 3, y + 1, 4, 4);
      } else {
        c.fillRect(x - 10, y - 10, 20, 16);
        c.fillRect(x - 7, y + 6, 4, 5);
        c.fillRect(x + 3, y + 6, 4, 5);
        c.fillStyle = "#000";
        c.fillRect(x - 6, y - 5, 4, 4);
        c.fillRect(x + 2, y - 5, 4, 4);
      }
    }
  const x = s.player.x * 36 + 18,
    y = s.player.y * 36 + 18;
  if (!drawSprite(c, "courier", s.player.x * 36, s.player.y * 36)) {
    c.fillStyle = C.gold;
    c.beginPath();
    c.moveTo(x, y - 14);
    c.lineTo(x + 12, y - 4);
    c.lineTo(x + 10, y + 11);
    c.lineTo(x - 10, y + 11);
    c.lineTo(x - 12, y - 4);
    c.closePath();
    c.fill();
    c.fillStyle = "#000";
    c.fillRect(x - 7, y - 4, 14, 5);
    c.fillStyle = C.white;
    c.fillRect(x - 3, y - 3, 6, 3);
  }
  line(
    c,
    [
      [x - 7, y + 15],
      [x + 7, y + 15],
    ],
    C.gold,
    3,
  );
  // Tactical warnings always win over people, supplies and landmark artwork.
  for (const key of threats) {
    const [tx, ty] = key.split(",").map(Number);
    if (!s.visible[ty]?.[tx] || s.tiles[ty]?.[tx] !== 0) continue;
    const px = tx * 36,
      py = ty * 36;
    c.strokeStyle = C.red;
    c.lineWidth = 3;
    c.strokeRect(px + 2, py + 2, 32, 32);
    line(
      c,
      [
        [px + 6, py + 6],
        [px + 12, py + 12],
      ],
      C.red,
    );
    line(
      c,
      [
        [px + 30, py + 6],
        [px + 24, py + 12],
      ],
      C.red,
    );
  }
  // Status is tactical information too: a crossing attack must not make an
  // injured enemy look fully healed or hide that it is disrupted.
  for (const e of s.enemies) {
    if (!s.visible[e.y][e.x]) continue;
    const x = e.x * 36 + 18,
      y = e.y * 36 + 18;
    if (e.hp < e.maxHp) {
      c.fillStyle = "#442326";
      c.fillRect(x - 12, y + 14, 24, 3);
      c.fillStyle = C.red;
      c.fillRect(x - 12, y + 14, (24 * e.hp) / e.maxHp, 3);
    }
    if (e.stun) {
      c.fillStyle = C.ice;
      c.fillRect(x - 3, y - 16, 6, 3);
    }
  }
  return performance.now() - start;
}
export function mapDescription(s) {
  const nearby = s.enemies.filter((e) => s.visible[e.y][e.x]);
  const registration =
    s.floor === 3 && s.landmark
      ? ` Moscone registration at column ${s.landmark.x}, row ${s.landmark.y}: ${s.landmark.resolved ? "visited." : "Enter its square to inspect the badge choice."}`
      : "";
  const transit =
    s.floor === 2 && s.landmark
      ? ` Powell cable car at column ${s.landmark.x}, row ${s.landmark.y}: ${s.landmark.resolved ? "visited." : "Enter its square to inspect the boarding choice."}`
      : "";
  const ferry =
    s.floor === 0 && s.landmark
      ? ` Ferry Building at column ${s.landmark.x}, row ${s.landmark.y}: ${s.landmark.resolved ? "visited." : "Enter its square to inspect the ferry supplies."}`
      : "";
  const relay = s.relay
    ? ` Lantern relay at column ${s.relay.x}, row ${s.relay.y}: ${s.relay.progress}/3. Stand there for three turns or pulse within range to power the uplink.`
    : "";
  return `${DISTRICTS[s.floor].name}. You are at column ${s.player.x}, row ${s.player.y}. ${nearby.length} visible hostiles. Uplink at column 9, row 9.${ferry}${transit}${registration}${relay} ${s.message}`;
}
