import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
const output = resolve("dist");
if (dirname(output) !== process.cwd() || !output.endsWith("dist"))
  throw new Error("Unexpected build output directory");
// Only this verified, project-local generated directory is replaced.
await rm(output, { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
for (const file of ["style.css", "manifest.webmanifest"])
  await cp(file, `dist/${file}`);
await writeFile(
  "dist/index.html",
  (await readFile("index.html", "utf8")).replace("./src/app.js", "./app.js"),
);
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "chrome120",
  outfile: "dist/app.js",
});
await mkdir("dist/licenses", { recursive: true });
await cp(
  "node_modules/@fontsource/oxanium/LICENSE",
  "dist/licenses/oxanium.txt",
);
await cp(
  "node_modules/@fontsource/atkinson-hyperlegible/LICENSE",
  "dist/licenses/atkinson.txt",
);
await cp("assets/add-to-glasses.png", "dist/assets/add-to-glasses.png");
await cp(
  "node_modules/@fontsource/oxanium/files/oxanium-latin-600-normal.woff2",
  "dist/assets/display.woff2",
);
await cp(
  "node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2",
  "dist/assets/reading.woff2",
);
// Code-native signal mark as a launcher PNG: no remote or generated raster dependency.
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([size, t, data, crc]);
}
const w = 192,
  raw = Buffer.alloc((w * 4 + 1) * w);
for (let y = 0; y < w; y++)
  for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - 96, y - 96),
      ring = d > 67 && d < 76 && !(x > 110 && y < 83),
      bolt = y > 47 && y < 143 && Math.abs(x - (125 - (y - 47) * 0.6)) < 12;
    const i = y * (w * 4 + 1) + 1 + x * 4;
    raw.set(
      ring
        ? [128, 232, 255, 255]
        : bolt
          ? [255, 210, 120, 255]
          : [0, 0, 0, 255],
      i,
    );
  }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w);
ihdr.writeUInt32BE(w, 4);
ihdr[8] = 8;
ihdr[9] = 6;
await writeFile(
  "dist/assets/icon.png",
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
const files = [
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "app.js",
  "assets/display.woff2",
  "assets/reading.woff2",
  "assets/icon.png",
];
const hash = createHash("sha256");
let bytes = 0;
for (const file of files) {
  const data = await readFile(`dist/${file}`);
  hash.update(data);
  bytes += data.length;
}
const template = await readFile("sw.js", "utf8");
hash.update(template);
const version = hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  template
    .replaceAll("__VERSION__", version)
    .replace("__SHELL__", JSON.stringify(files)),
);
await writeFile("dist/.nojekyll", "");
console.log(
  `FOGFALL ${version}: ${files.length} cached assets, ${(bytes / 1024).toFixed(1)} KiB before compression.`,
);
