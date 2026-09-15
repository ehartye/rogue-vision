import { drawWaterfrontEdge, drawWarehouse } from "./waterfront.js";
import { drawChinatownShop } from "./chinatown.js";
import { drawTransitCrossing } from "./transit.js";
// Scenery reads only discovered terrain. It never consumes the simulation RNG
// or writes to the run, so a reload (including an old save) keeps the same city.
const THEMES = [
  {
    roof: "#223d46",
    face: "#2a444b",
    edge: "#70959b",
    trim: "#597b82",
    light: "#a4b2a0",
    accent: "#647e88",
  },
  {
    roof: "#293c3b",
    face: "#423f36",
    edge: "#8d9273",
    trim: "#637d70",
    light: "#c3a971",
    accent: "#a16e50",
  },
  {
    roof: "#2a3c46",
    face: "#34494d",
    edge: "#8aaba4",
    trim: "#708583",
    light: "#aeb89a",
    accent: "#7b7770",
  },
  {
    roof: "#343d4c",
    face: "#414752",
    edge: "#9d9caa",
    trim: "#757c8c",
    light: "#b2b3bd",
    accent: "#778b9c",
  },
];
function variation(seed, x, y) {
  let n =
    (seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
function rect(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function line(c, color, points, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

function frontage(c, s, x, y, p, known) {
  // A few two-cell compositions interrupt the window rhythm. The fixed anchors
  // don't slide as fog clears, and both cells must already be discovered walls.
  const anchor = 1 + 3 * Math.floor((x - 1) / 3);
  if (
    x > anchor + 1 ||
    anchor < 1 ||
    !known(anchor, y, 1) ||
    !known(anchor + 1, y, 1) ||
    !known(anchor, y + 1, 0) ||
    !known(anchor + 1, y + 1, 0)
  )
    return;
  const variant = variation(s.seed, anchor, y) % 2;
  c.save();
  c.translate((anchor - x) * 36, 0);
  rect(c, p.face, 5, 8, 62, 22);
  if (s.floor === 0) {
    // Warehouse loading bays and a pier name board.
    rect(c, "#172c34", 9, 15, 30, 15);
    for (let a = 15; a < 39; a += 6) rect(c, p.trim, a, 16, 1, 13);
    line(
      c,
      p.edge,
      [
        [8, 30],
        [8, 14],
        [40, 14],
        [40, 30],
      ],
      2,
    );
    rect(c, p.trim, 43, 9, 23, 9);
    c.fillStyle = p.light;
    c.font = "bold 7px monospace";
    c.fillText("PIER", 46, 16);
    for (let a = 45; a < 62; a += 9) {
      rect(c, p.accent, a, 23 - variant * 3, 7, 7 + variant * 3);
      line(c, p.edge, [
        [a + 1, 24],
        [a + 6, 29],
      ]);
    }
  } else if (s.floor === 1) {
    // Broad turned-up eaves, a tea-shop sign and differently sized shop bays.
    rect(c, p.roof, 4, 4, 64, 7);
    line(
      c,
      p.edge,
      [
        [3, 6],
        [9, 11],
        [63, 11],
        [69, 6],
      ],
      2,
    );
    line(
      c,
      p.trim,
      [
        [12, 7],
        [60, 7],
      ],
      2,
    );
    rect(c, p.accent, 6, 14, 61, 4);
    rect(c, "#202d2d", 11, 19, 20, 11);
    rect(c, p.light, 13, 20, 16, 6);
    rect(c, p.trim, 20, 20, 2, 10);
    rect(c, "#202d2d", 36, 19, 10, 12);
    rect(c, p.light, 43, 25, 1, 2);
    rect(c, p.roof, 49, 19, 16, 10);
    line(c, p.trim, [
      [51, 21],
      [63, 21],
    ]);
    line(c, p.trim, [
      [51, 25],
      [63, 25],
    ]);
    rect(c, p.face, 28, 3, 23, 8);
    c.fillStyle = p.light;
    c.font = "bold 7px monospace";
    c.fillText(variant ? "TEA" : "WOK", 32, 10);
  } else if (s.floor === 2) {
    // Projecting bay windows, a stepped cornice and a recessed street doorway.
    line(
      c,
      p.edge,
      [
        [6, 10],
        [6, 6],
        [28, 6],
        [28, 9],
        [65, 9],
      ],
      2,
    );
    for (const a of [12, 42]) {
      c.fillStyle = p.trim;
      c.beginPath();
      c.moveTo(a, 15);
      c.lineTo(a + 4, 11);
      c.lineTo(a + 14, 11);
      c.lineTo(a + 18, 15);
      c.lineTo(a + 18, 26);
      c.lineTo(a, 26);
      c.fill();
      rect(c, "#22383d", a + 2, 15, 14, 10);
      rect(c, p.light, a + 6, 13, 6, 10);
      rect(c, p.face, a + 6, 18, 6, 1);
      line(c, p.edge, [
        [a, 26],
        [a + 18, 26],
      ]);
    }
    rect(c, "#172b33", 33, 20, 6, 11);
    rect(c, p.accent, 33, 14, 6, 4);
  } else {
    // One sweeping convention-hall canopy across several entrance doors.
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(5, 17);
    c.quadraticCurveTo(36, 0, 67, 17);
    c.lineTo(67, 20);
    c.lineTo(5, 20);
    c.fill();
    line(
      c,
      p.edge,
      [
        [6, 20],
        [66, 20],
      ],
      2,
    );
    for (let a = 12; a < 65; a += 12) {
      rect(c, "#20343f", a, 22, 7, 9);
      rect(c, p.light, a, 22, 1, 9);
    }
    rect(c, p.edge, 6, 21, 2, 10);
    rect(c, p.edge, 65, 21, 2, 10);
  }
  c.restore();
}

function wall(c, s, x, y, p, known) {
  if (s.floor === 0 && drawWaterfrontEdge(c, x, y)) return;
  const north = known(x, y - 1, 1),
    south = known(x, y + 1, 1),
    west = known(x - 1, y, 1),
    east = known(x + 1, y, 1),
    left = west ? 0 : 3,
    right = east ? 36 : 33,
    top = north ? 0 : 3,
    bottom = south ? 36 : 33,
    v = variation(s.seed, x, y);
  // A shared surface extends to cell boundaries only inside known structures.
  // No per-cell outline: only the outside contour and street-facing facade.
  rect(c, p.roof, left, top, right - left, bottom - top);
  if (!south) {
    rect(c, p.face, left, 15, right - left, 16);
    rect(c, p.trim, left, 30, right - left, 2);
    rect(c, p.edge, left, 33, right - left, 1);
    if (s.floor === 0) {
      drawWarehouse(c, p, v % 3, left, right);
    } else if (s.floor === 1) {
      drawChinatownShop(c, p, v % 4, left, right);
    } else if (s.floor === 3) {
      // Broad glazed bays under a continuous stone lintel.
      rect(c, p.trim, left, 14, right - left, 3);
      for (let a = 7; a < 32; a += 12) {
        rect(c, "#20343f", a, 19, 7, 10);
        rect(c, p.light, a, 19, 1, 10);
      }
      if (x % 3 === 0) rect(c, p.edge, 2, 17, 3, 15);
    } else {
      // Grouped shop windows and recessed doors, with varied awning spans.
      for (let a = 6; a < 32; a += 12) {
        rect(c, "#1c2d31", a, 18, 8, 10);
        rect(c, p.light, a + 1, 19, 5, 4);
        rect(c, p.trim, a + 3, 19, 1, 8);
      }
      if (v % 4 === 0) {
        rect(c, "#152a30", 12, 19, 10, 12);
        rect(c, p.light, 19, 25, 1, 2);
      }
      const awning = (Math.floor(x / 2) + y) % 3;
      if (awning !== 0) {
        rect(c, awning === 1 ? p.accent : p.trim, left, 13, right - left, 4);
        for (let a = 4; a < 36; a += 8) rect(c, p.edge, a, 14, 2, 3);
      }

    }
  }
  // Roof vocabulary reads across joined cells; equipment is deliberately sparse.
  if (s.floor === 0) {
    for (let a = 7; a < 36; a += 8)
      line(c, p.trim, [
        [a, top + 2],
        [a - 3, south ? bottom - 2 : 12],
      ]);
  } else if (s.floor === 1) {
    for (let b = top + 3; b < (south ? bottom : 13); b += 4)
      line(c, p.trim, [
        [left, b],
        [right, b],
      ]);
    if (!south)
      line(
        c,
        p.edge,
        [
          [left, 12],
          [right, 12],
        ],
        2,
      );
    if (!west && !south)
      line(
        c,
        p.edge,
        [
          [2, 10],
          [5, 12],
          [9, 12],
        ],
        2,
      );
    if (!east && !south)
      line(
        c,
        p.edge,
        [
          [27, 12],
          [31, 12],
          [34, 10],
        ],
        2,
      );
  } else if (v % 3 === 0) {
    // Offset rooftop vents / skylights avoid a repeated object in every square.
    rect(c, "#172b33", 10, top + 3, 14, 6);
    line(c, p.trim, [
      [10, top + 8],
      [10, top + 3],
      [23, top + 3],
      [23, top + 8],
    ]);
    rect(c, p.trim, 14, top + 5, 6, 1);
  }
  if (!north)
    line(c, p.edge, [
      [left, top],
      [right, top],
    ]);
  if (!west)
    line(c, p.trim, [
      [left, top],
      [left, bottom],
    ]);
  if (!east)
    line(c, p.trim, [
      [right, top],
      [right, bottom],
    ]);
  // Long side elevations get occasional windows instead of tiny front doors.
  if (south && (!west || !east) && v % 3 !== 0) {
    const a = west ? 28 : 5;
    rect(c, p.light, a, 17, 3, 6);
    rect(c, p.trim, a, 24, 3, 1);
  }
  if (!south) frontage(c, s, x, y, p, known);
}

function street(c, s, x, y, known) {
  if (s.floor === 2) drawTransitCrossing(c, x, y, known);
  const ink = "#28454f";
  // Curbs belong to the known street, leaving its centre free for actors/items.
  if (known(x, y - 1, 1)) rect(c, ink, 3, 2, 30, 1);
  if (known(x, y + 1, 1)) rect(c, ink, 3, 33, 30, 1);
  if (known(x - 1, y, 1)) rect(c, ink, 2, 3, 1, 30);
  if (known(x + 1, y, 1)) rect(c, ink, 33, 3, 1, 30);
  if (s.floor === 0 && x === 1) {
    // Promenade paving along the waterfront boundary.
    line(c, ink, [
      [5, 0],
      [5, 36],
    ]);
    if (y % 3 === 0) {
      rect(c, "#52676d", 6, 7, 3, 4);
      rect(c, ink, 6, 20, 3, 4);
    }
  } else if (s.floor === 2 && y === 1) {
    // Northern street segments carry cable-car rails. Stop at every blocked or
    // undiscovered neighbour; the decoration must never imply a hidden route.
    const from = known(x - 1, y, 0) ? 0 : 5,
      to = known(x + 1, y, 0) ? 36 : 31;
    line(c, ink, [
      [from, 9],
      [to, 9],
    ]);
    line(c, ink, [
      [from, 27],
      [to, 27],
    ]);
  } else if (s.floor === 3 && (x + y) % 3 === 0) {
    line(c, ink, [
      [5, 5],
      [10, 5],
    ]);
    line(c, ink, [
      [26, 31],
      [31, 31],
    ]);
  }
  rect(c, s.visible[y][x] ? "#48737d" : "#213a43", 17, 17, 3, 3);
}

export function drawScenery(c, s) {
  const p = THEMES[s.floor],
    known = (x, y, tile) => Boolean(s.seen[y]?.[x] && s.tiles[y][x] === tile);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      if (!s.seen[y][x]) {
        rect(c, "#182f38", x * 36 + 17, y * 36 + 17, 2, 2);
        continue;
      }
      c.save();
      c.translate(x * 36, y * 36);
      // Even projecting eaves can never cover an actor or reveal an unknown cell.
      c.beginPath();
      c.rect(0, 0, 36, 36);
      c.clip();
      c.globalAlpha = s.visible[y][x] ? 1 : 0.3;
      if (s.tiles[y][x] === 1) wall(c, s, x, y, p, known);
      else street(c, s, x, y, known);
      c.restore();
    }
}
