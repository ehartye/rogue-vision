// Public registration marker: the entrance stays inside its encounter square.
export function drawMoscone(c, s) {
  if (s.floor !== 3 || !s.landmark) return false;
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
  // Stone jambs frame glass doors; the canopy sweeps upward over the plaza.
  box("#757681", 4, 13, 28, 18);
  box("#223c4b", 7, 14, 22, 16);
  for (const dx of [8, 15, 22]) {
    box("#63868e", dx, 15, 5, 14);
    box("#99aeb0", dx, 15, 1, 14);
    box("#a2b4b5", dx + 3, 23, 1, 3);
  }
  c.fillStyle = "#a3a2ad";
  c.beginPath();
  c.moveTo(2, 13);
  c.quadraticCurveTo(17, 12, 33, 4);
  c.lineTo(33, 8);
  c.quadraticCurveTo(18, 16, 2, 16);
  c.closePath();
  c.fill();
  box("#333444", 7, 6, 22, 6);
  c.fillStyle = "#b9bbc5";
  c.font = "bold 5px monospace";
  c.fillText("MOSCONE", 7, 11);
  // A small registration desk, below the doors, leaves actors unobstructed.
  box("#8d8598", 12, 27, 12, 4);
  box("#adc3c4", 17, 25, 3, 3);
  box("#4a465b", 6, 32, 24, 1);
  if (!resolved) {
    box("#ffd278", 2, 30, 2, 5);
    box("#ffd278", 2, 33, 7, 2);
    box("#ffd278", 32, 30, 2, 5);
    box("#ffd278", 27, 33, 7, 2);
  }
  c.restore();
  return true;
}
