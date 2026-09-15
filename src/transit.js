// Powell cable car, drawn inside the existing public encounter square.
export function drawCableCar(c, s) {
  if (s.floor !== 2 || !s.landmark) return false;
  const { x, y, resolved } = s.landmark;
  if (resolved && !s.seen[y][x]) return true;
  c.save();
  c.translate(x * 36, y * 36);
  c.beginPath();
  c.rect(0, 0, 36, 36);
  c.clip();
  c.globalAlpha = resolved ? 0.38 : s.visible[y][x] ? 1 : 0.6;
  const box = (color, x, y, w, h) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  // Roof bell, overhanging canopy and timber sides distinguish the open car.
  box("#aebcaf", 16, 3, 4, 3);
  box("#566e70", 5, 7, 26, 3);
  box("#abb9a7", 7, 6, 22, 2);
  box("#b29a6f", 5, 11, 2, 17);
  box("#b29a6f", 29, 11, 2, 17);
  box("#967259", 10, 10, 16, 18);
  box("#1c3840", 12, 12, 12, 9);
  box("#97b6b4", 13, 13, 4, 6);
  box("#97b6b4", 19, 13, 4, 6);
  // Open end platforms and their brass handrails stay visibly separate.
  box("#4c3631", 3, 25, 30, 4);
  box("#c5ad7d", 3, 21, 7, 2);
  box("#c5ad7d", 26, 21, 7, 2);
  box("#b29a6f", 3, 17, 2, 10);
  box("#b29a6f", 31, 17, 2, 10);
  box("#dec491", 11, 23, 14, 4);
  c.fillStyle = "#3d4645";
  c.font = "bold 5px monospace";
  c.fillText("SF", 15, 27);
  box("#728b87", 8, 29, 5, 3);
  box("#728b87", 23, 29, 5, 3);
  box("#3c6068", 4, 33, 28, 1);
  if (!resolved) {
    box("#ffd278", 2, 30, 2, 5);
    box("#ffd278", 2, 33, 7, 2);
    box("#ffd278", 32, 30, 2, 5);
    box("#ffd278", 27, 33, 7, 2);
  }
  c.restore();
  return true;
}

export function drawTransitCrossing(c, x, y, known) {
  // Small crossing fragments at discovered intersections; never draw through
  // hidden/blocked neighbours or across the centre reserved for actors/items.
  if (
    y !== 1 ||
    x % 3 !== 2 ||
    !known(x, y + 1, 0) ||
    !known(x - 1, y, 0) ||
    !known(x + 1, y, 0)
  )
    return;
  c.fillStyle = "#456069";
  for (const a of [6, 12, 22, 28]) c.fillRect(a, 30, 3, 3);
}
