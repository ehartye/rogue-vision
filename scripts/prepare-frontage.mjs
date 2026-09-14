// Compile the approved generated source to its actual 36px gameplay footprint.
// Optional authoring only: use the sprite tool's existing canvas dependency.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
const cli = process.env.SPRITE_CLI;
if (!cli) throw Error("Set SPRITE_CLI to the installed sprite.js path.");
const { createCanvas, loadImage } = createRequire(resolve(cli))("canvas");
const source = await loadImage("assets/art/source/chinatown-frontage.png");
const tile = createCanvas(36, 36),
  c = tile.getContext("2d");
c.imageSmoothingEnabled = false;
c.drawImage(source, 0, 0, 36, 36);
await writeFile(
  "assets/art/chinatown-frontage.png",
  tile.toBuffer("image/png"),
);
console.log(
  "Compiled Chinatown storefront at 36×36; original retained in assets/art/source.",
);
