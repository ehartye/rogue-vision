import atlas from "../assets/art/people.atlas.json" with { type: "json" };

const frames = new Map(
  atlas.frames.map((entry) => [entry.filename, entry.frame]),
);
const images = {};
let loading;

// Optional artwork never gates input or saving. A failed asset keeps its vector
// fallback; the next page load retries. No authoring tools run in the game.
export function loadArt(onImageReady) {
  return (loading ??= Promise.all(
    ["people"].map(
      (name) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            images[name] = image;
            resolve();
            onImageReady?.();
          };
          image.onerror = () => resolve();
          image.src = new URL(`assets/art/${name}.png`, document.baseURI).href;
        }),
    ),
  ));
}
export function artReady() {
  return Boolean(images.people);
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
