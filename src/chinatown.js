import { drawSprite } from "./art.js";

export function drawDragonGate(c, s) {
  if (s.floor !== 1 || !s.landmark) return false;
  const { x, y, resolved } = s.landmark;
  if (resolved && !s.seen[y][x]) return true;
  const alpha = resolved ? 0.4 : s.visible[y][x] ? 1 : 0.6;
  c.save();
  c.translate(x * 36, y * 36);
  c.beginPath();
  c.rect(0, 0, 36, 36);
  c.clip();
  c.globalAlpha = alpha;
  // Keep the accepted sprite. A quiet silhouette identifies the public beacon
  // before exploration or if the optional sprite sheet has not loaded.
  if (!(s.seen[y][x] && drawSprite(c, "dragon-gate", 0, 0, alpha))) {
    c.fillStyle = "#9c9b7b";
    c.fillRect(7, 15, 4, 16);
    c.fillRect(25, 15, 4, 16);
    c.fillRect(10, 18, 16, 3);
    c.fillStyle = "#658776";
    c.beginPath();
    c.moveTo(3, 7);
    c.lineTo(9, 11);
    c.lineTo(27, 11);
    c.lineTo(33, 7);
    c.lineTo(30, 16);
    c.lineTo(6, 16);
    c.closePath();
    c.fill();
    c.fillStyle = "#c0ad7e";
    c.fillRect(14, 13, 8, 4);
  }
  if (!resolved) {
    c.fillStyle = "#ffd278";
    c.fillRect(2, 30, 2, 5);
    c.fillRect(2, 33, 7, 2);
    c.fillRect(32, 30, 2, 5);
    c.fillRect(27, 33, 7, 2);
  }
  c.restore();
  return true;
}

// These details live only on discovered building fronts. Muted lanterns have
// neither the gold border nor progress lights of the playable relay.
export function drawChinatownShop(c, p, variant, left, right) {
  const box = (color, x, y, w, h) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  box(p.face, left, 15, right - left, 15);
  if (variant === 0) {
    // Closed rolling shutter beneath a faded shop awning.
    box("#253631", 6, 18, 24, 12);
    for (let y = 20; y < 30; y += 3) box("#607164", 7, y, 22, 1);
    box("#806449", 4, 14, 28, 4);
  } else if (variant === 1) {
    // Recessed produce stall: a scalloped awning and two shallow crates.
    box("#1b2c2a", 5, 18, 26, 12);
    box("#877856", 3, 14, 30, 3);
    for (let x = 4; x < 32; x += 6) box("#a09368", x, 17, 4, 2);
    box("#736449", 6, 26, 24, 4);
    for (let x = 8; x < 30; x += 5) {
      box(x % 2 ? "#988157" : "#78906a", x, 23, 3, 3);
    }
    box("#3b3c31", 17, 26, 2, 4);
  } else if (variant === 2) {
    // A lattice window beside a narrow vertical sign.
    box("#233b32", 6, 18, 16, 11);
    for (const x of [7, 13, 19]) box("#9b9570", x, 19, 1, 9);
    box("#9b9570", 7, 23, 13, 1);
    box("#776047", 26, 15, 5, 15);
    for (const y of [17, 21, 25]) box("#b29d70", 27, y, 3, 2);
  } else {
    // Small paired lanterns, used selectively instead of on every shop.
    box("#21332f", 11, 19, 13, 11);
    box("#718371", 12, 20, 5, 7);
    box("#526f62", 4, 16, 27, 1);
    for (const [x, y] of [[6, 20], [28, 22]]) {
      box("#526f62", x, 17, 1, y - 17);
      box("#8b6349", x - 2, y, 5, 6);
      box("#aa8b58", x, y + 1, 1, 4);
      box("#63745e", x, y + 6, 1, 2);
    }
  }
}
