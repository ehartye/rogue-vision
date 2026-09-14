import atlas from "../assets/art/people.atlas.json" with { type: "json" };

const frames = new Map(
  atlas.frames.map((entry) => [entry.filename, entry.frame]),
);
const images = {};
let loading;

// Optional artwork never gates input or saving. A failed asset keeps its vector
// fallback; the next page load retries. No authoring tools run in the game.
export function loadArt() {
  return (loading ??= Promise.all(
    ["people", "chinatown-frontage"].map(
      (name) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            images[name] = image;
            resolve();
          };
          image.onerror = () => resolve();
          image.src = new URL(`assets/art/${name}.png`, document.baseURI).href;
        }),
    ),
  ));
}
export function artReady() {
  return Boolean(images.people && images["chinatown-frontage"]);
}
export function drawSprite(c, name, x, y, opacity = 1) {
  const frame = frames.get(name);
  if (!images.people || !frame) return false;
  c.save();
  c.imageSmoothingEnabled = false;
  c.globalAlpha = opacity;
  c.drawImage(images.people, frame.x, frame.y, frame.w, frame.h, x, y, 36, 36);
  c.restore();
  return true;
}

export function drawChinatownWall(c, s, x, y) {
  const tile = images["chinatown-frontage"];
  if (!tile) return false;
  const px = x * 36,
    py = y * 36;
  c.save();
  c.imageSmoothingEnabled = false;
  c.globalAlpha = s.visible[y][x] ? 0.78 : 0.24;
  c.drawImage(tile, px, py, 36, 36);
  // Join thresholds only through known blocked cells. No decoration crosses a
  // walkable gap, and unknown neighbours do not reveal the procedural layout.
  c.fillStyle = "#82765c";
  if (s.tiles[y]?.[x - 1] === 1 && s.seen[y][x - 1])
    c.fillRect(px, py + 32, 3, 2);
  if (s.tiles[y]?.[x + 1] === 1 && s.seen[y][x + 1])
    c.fillRect(px + 33, py + 32, 3, 2);
  if (x === 2 && y === 0) {
    c.fillStyle = "#142630";
    c.fillRect(px + 2, py + 24, 32, 8);
    c.fillStyle = "#a1c5c4";
    c.font = "bold 7px monospace";
    c.fillText("GRANT", px + 6, py + 31);
  }
  c.restore();
  return true;
}

export function drawChinatownStreet(c, x, y, visible) {
  // Sparse curb/crosswalk fragments leave the tile centre and threat rim free.
  c.fillStyle = visible ? "#284047" : "#182b32";
  if (x === 1 && y % 4 === 0)
    for (let offset = 7; offset < 30; offset += 7)
      c.fillRect(x * 36 + offset, y * 36 + 5, 3, 6);
}
