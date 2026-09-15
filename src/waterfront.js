// Embarcadero's visual vocabulary. All coordinates are confined to one 36px
// cell by the caller (or by the landmark clip below); no simulation writes.
const P = {
  water: "#102d3b",
  ripple: "#335865",
  stone: "#c0c2a6",
  shade: "#455c60",
  trim: "#79958f",
  roof: "#3e706e",
  gold: "#ffd278",
};
function box(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function stroke(c, color, points, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

export function drawFerryBuilding(c, s) {
  if (s.floor !== 0 || !s.landmark) return false;
  const { x, y, resolved } = s.landmark;
  // Like the original ring, the unvisited landmark is a public beacon. Its
  // drawing does not inspect or reveal any surrounding terrain.
  if (resolved && !s.seen[y][x]) return true;
  c.save();
  c.translate(x * 36, y * 36);
  c.beginPath();
  c.rect(0, 0, 36, 36);
  c.clip();
  c.globalAlpha = resolved ? 0.38 : s.visible[y][x] ? 1 : 0.6;
  // Long arcade wings, then the stepped clock tower rising above their roof.
  box(c, P.shade, 2, 25, 32, 7);
  box(c, P.stone, 3, 25, 30, 2);
  stroke(
    c,
    P.roof,
    [
      [2, 24],
      [10, 21],
      [26, 21],
      [34, 24],
    ],
    2,
  );
  for (const a of [4, 8, 25, 29]) {
    box(c, P.stone, a, 28, 2, 4);
    box(c, "#203b43", a + 2, 28, 2, 4);
  }
  box(c, P.shade, 12, 9, 12, 23);
  box(c, P.stone, 12, 9, 2, 22);
  box(c, P.trim, 22, 9, 2, 22);
  box(c, P.roof, 14, 6, 8, 4);
  stroke(
    c,
    P.stone,
    [
      [13, 8],
      [18, 2],
      [23, 8],
    ],
    2,
  );
  box(c, P.stone, 17, 2, 2, 3);
  box(c, P.stone, 11, 9, 14, 2);
  box(c, P.trim, 11, 20, 14, 2);
  // Large, quiet clock face is the identifying feature at native glasses size.
  c.fillStyle = P.gold;
  c.beginPath();
  c.arc(18, 15, 4, 0, Math.PI * 2);
  c.fill();
  stroke(
    c,
    "#233b42",
    [
      [18, 12],
      [18, 15],
      [21, 15],
    ],
    1,
  );
  box(c, "#203b43", 16, 23, 4, 8);
  box(c, P.trim, 16, 24, 4, 1);
  box(c, P.trim, 16, 27, 4, 1);
  box(c, P.stone, 10, 31, 16, 1);
  if (!resolved) {
    // A gold threshold, rather than a wall outline, marks the enterable square.
    stroke(
      c,
      P.gold,
      [
        [3, 30],
        [3, 34],
        [10, 34],
      ],
      2,
    );
    stroke(
      c,
      P.gold,
      [
        [26, 34],
        [33, 34],
        [33, 30],
      ],
      2,
    );
  }
  c.restore();
  return true;
}

export function drawWaterfrontEdge(c, x, y) {
  if (x !== 0) return false;
  // The outer boundary is already blocked: water and a seawall give it meaning.
  box(c, P.water, 0, 0, 29, 36);
  for (let row = 5; row < 36; row += 9) {
    const start = (y * 7 + row) % 13;
    stroke(c, P.ripple, [
      [start, row],
      [start + 5, row],
      [start + 8, row - 1],
      [start + 12, row - 1],
    ]);
  }
  box(c, "#273f46", 28, 0, 8, 36);
  box(c, P.trim, 29, 0, 2, 36);
  box(c, "#536c6c", 34, 0, 2, 36);
  if (y % 3 === 1) {
    box(c, P.shade, 22, 8, 10, 6);
    box(c, P.stone, 24, 8, 5, 2);
    stroke(c, P.trim, [
      [23, 15],
      [20, 19],
      [21, 24],
      [25, 26],
    ]);
  }
  return true;
}

export function drawWarehouse(c, p, variant, left, right) {
  // Three different elevations keep storage sheds from becoming window strips.
  if (variant === 0) {
    box(c, "#172c34", 7, 18, 22, 12);
    stroke(
      c,
      p.edge,
      [
        [6, 30],
        [6, 17],
        [30, 17],
        [30, 30],
      ],
      2,
    );
    for (let a = 12; a < 29; a += 6) box(c, p.trim, a, 19, 1, 10);
  } else if (variant === 1) {
    box(c, p.trim, left, 16, right - left, 2);
    for (const a of [7, 22]) {
      box(c, "#152b33", a, 20, 7, 8);
      box(c, p.light, a, 20, 7, 2);
      box(c, p.trim, a + 3, 22, 1, 6);
    }
  } else {
    // A closed loading shutter with offset pallet stacks, no false door cue.
    box(c, "#203740", 8, 18, 18, 12);
    for (let b = 20; b < 29; b += 3) box(c, p.trim, 9, b, 16, 1);
    box(c, "#647367", 25, 25, 6, 6);
    stroke(c, p.light, [
      [26, 26],
      [30, 30],
    ]);
    box(c, p.trim, 4, 28, 4, 3);
  }
}
