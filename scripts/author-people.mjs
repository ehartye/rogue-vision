// Optional authoring step; normal builds consume the committed exports.
// SPRITE_CLI points to the installed standalone sprite.js; SPRITE_PORT selects
// its authoring session. All shapes have stable names for later pose editing.
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const out = ".artifacts/sprite-export",
  palette = {
    ink: "#142630",
    edge: "#69969b",
    skin: "#edba92",
    skinShade: "#ad7862",
    gold: "#ffd278",
    ochre: "#ae7439",
    light: "#fff0be",
    blue: "#467381",
    boot: "#9cb0ac",
    red: "#ff827d",
    rust: "#a94f52",
    cloth: "#809794",
    darkCloth: "#42565a",
    jade: "#76bca2",
    teal: "#376f67",
    ice: "#80e8ff",
    purple: "#eea9ff",
    violet: "#795f91",
  };
const ops = [
  {
    command: "new",
    name: "fogfall-people",
    size: 36,
    rows: 1,
    cols: 6,
    dest: out,
  },
];
let cell;
function sprite(index, name) {
  cell = `0,${index}`;
  ops.push({ command: "name", cell, as: name });
}
function rect(name, x, y, w, h, color) {
  ops.push({
    command: "draw",
    type: "rect",
    cell,
    name,
    x,
    y,
    w,
    h,
    color: palette[color] ?? color,
    filled: true,
  });
}
function poly(name, points, color) {
  ops.push({
    command: "draw",
    type: "polygon",
    cell,
    name,
    points: points.map(([x, y]) => `${x},${y}`).join(" "),
    color: palette[color] ?? color,
    filled: true,
  });
}
sprite(0, "courier");
rect("far-trouser", 19, 21, 4, 9, "blue");
rect("far-boot", 19, 29, 7, 2, "boot");
rect("near-trouser-outline", 12, 21, 6, 10, "ink");
rect("near-trouser", 13, 22, 4, 9, "blue");
rect("near-boot", 12, 30, 7, 2, "light");
poly(
  "jacket-outline",
  [
    [12, 12],
    [22, 12],
    [25, 22],
    [21, 26],
    [11, 24],
    [9, 18],
  ],
  "ink",
);
poly(
  "jacket",
  [
    [13, 13],
    [21, 13],
    [23, 22],
    [19, 25],
    [12, 23],
    [11, 17],
  ],
  "gold",
);
rect("jacket-shadow", 18, 15, 3, 9, "ochre");
rect("jacket-light", 12, 15, 2, 7, "light");
rect("neck", 17, 11, 4, 3, "skinShade");
rect("face-shadow", 16, 6, 7, 7, "skinShade");
rect("face", 18, 7, 6, 5, "skin");
rect("nose", 23, 9, 2, 2, "skin");
rect("eye", 22, 8, 1, 1, "ink");
rect("cap", 15, 4, 8, 3, "blue");
rect("cap-rim", 15, 7, 11, 2, "ink");
rect("cap-light", 16, 4, 6, 1, "ice");
poly(
  "far-arm",
  [
    [22, 14],
    [24, 15],
    [25, 23],
    [22, 24],
  ],
  "ochre",
);
rect("hand", 23, 23, 3, 3, "skin");
poly(
  "satchel-strap",
  [
    [20, 13],
    [22, 14],
    [13, 22],
    [11, 21],
  ],
  "ink",
);
rect("satchel-outline", 6, 19, 9, 9, "ink");
rect("satchel", 7, 20, 7, 7, "gold");
rect("satchel-flap", 7, 20, 7, 2, "light");
rect("satchel-clasp", 10, 23, 2, 2, "ochre");

sprite(1, "husk");
poly(
  "far-leg",
  [
    [17, 22],
    [21, 22],
    [22, 29],
    [19, 30],
  ],
  "darkCloth",
);
rect("far-shoe", 19, 29, 6, 2, "boot");
poly(
  "near-leg",
  [
    [13, 22],
    [17, 23],
    [14, 29],
    [12, 30],
  ],
  "edge",
);
rect("near-shoe", 10, 30, 6, 2, "boot");
poly(
  "slumped-coat-outline",
  [
    [16, 10],
    [22, 11],
    [21, 18],
    [19, 26],
    [15, 24],
    [11, 25],
    [10, 19],
    [12, 13],
  ],
  "ink",
);
poly(
  "slumped-coat",
  [
    [16, 11],
    [21, 12],
    [19, 18],
    [18, 24],
    [15, 23],
    [12, 24],
    [11, 19],
    [13, 14],
  ],
  "cloth",
);
poly(
  "coat-shadow",
  [
    [15, 14],
    [18, 14],
    [16, 22],
    [13, 24],
  ],
  "darkCloth",
);
poly(
  "hanging-far-arm",
  [
    [20, 13],
    [23, 15],
    [23, 23],
    [21, 23],
    [20, 18],
  ],
  "darkCloth",
);
rect("far-hand", 21, 23, 3, 4, "rust");
poly(
  "hanging-near-arm",
  [
    [13, 14],
    [15, 15],
    [12, 23],
    [11, 27],
    [9, 27],
    [10, 21],
  ],
  "edge",
);
rect("near-hand", 9, 25, 3, 4, "red");
rect("head-shadow", 19, 8, 7, 6, "skinShade");
rect("head", 20, 8, 6, 4, "skin");
rect("face", 24, 10, 3, 4, "red");
rect("eye", 25, 10, 1, 1, "ink");
rect("hair", 19, 7, 6, 2, "cloth");
rect("torn-hem", 15, 23, 2, 3, "ink");
rect("collar", 17, 11, 3, 3, "boot");

sprite(2, "runner");
poly(
  "back-leg",
  [
    [14, 21],
    [18, 23],
    [13, 27],
    [8, 25],
    [9, 23],
    [12, 24],
  ],
  "edge",
);
rect("back-shoe", 6, 23, 4, 3, "boot");
poly(
  "stride-leg",
  [
    [19, 22],
    [22, 22],
    [22, 28],
    [27, 29],
    [27, 31],
    [18, 30],
    [17, 25],
  ],
  "blue",
);
rect("stride-shoe", 24, 30, 6, 2, "boot");
poly(
  "leaning-jacket-outline",
  [
    [18, 11],
    [24, 12],
    [24, 18],
    [19, 25],
    [12, 23],
    [14, 16],
  ],
  "ink",
);
poly(
  "leaning-jacket",
  [
    [18, 12],
    [23, 13],
    [22, 18],
    [18, 24],
    [13, 22],
    [16, 16],
  ],
  "darkCloth",
);
poly(
  "jacket-edge",
  [
    [18, 13],
    [20, 13],
    [16, 21],
    [13, 21],
  ],
  "cloth",
);
poly(
  "back-arm",
  [
    [17, 14],
    [15, 18],
    [9, 15],
    [8, 17],
    [15, 21],
    [19, 16],
  ],
  "edge",
);
rect("back-hand", 6, 14, 4, 3, "skin");
poly(
  "forward-arm",
  [
    [23, 14],
    [26, 16],
    [26, 20],
    [29, 20],
    [29, 22],
    [23, 22],
    [22, 17],
  ],
  "cloth",
);
rect("forward-hand", 28, 19, 3, 3, "red");
rect("head", 22, 7, 6, 6, "skin");
rect("hair", 21, 6, 6, 3, "darkCloth");
rect("face", 27, 9, 2, 4, "red");
rect("eye", 27, 9, 1, 1, "ink");
rect("scarf", 20, 12, 7, 2, "red");
poly(
  "trailing-scarf",
  [
    [20, 12],
    [18, 15],
    [10, 12],
    [11, 10],
  ],
  "rust",
);

sprite(3, "relay");
rect("far-leg", 19, 24, 4, 7, "edge");
rect("far-boot", 19, 30, 7, 2, "boot");
rect("near-leg", 13, 23, 4, 8, "blue");
rect("near-boot", 11, 30, 7, 2, "boot");
rect("radio-outline", 6, 10, 9, 16, "ink");
rect("radio-case", 7, 11, 7, 13, "teal");
rect("radio-edge", 7, 11, 2, 12, "jade");
rect("radio-panel", 9, 15, 4, 6, "ink");
rect("radio-light", 10, 16, 2, 2, "ice");
rect("antenna-tall", 8, 3, 1, 9, "boot");
rect("antenna-tall-tip", 7, 2, 3, 3, "red");
rect("antenna-short", 12, 6, 1, 5, "boot");
rect("antenna-short-tip", 11, 5, 3, 2, "red");
poly(
  "coat-outline",
  [
    [15, 12],
    [22, 12],
    [24, 22],
    [21, 27],
    [12, 26],
    [11, 18],
  ],
  "ink",
);
poly(
  "coat",
  [
    [16, 13],
    [21, 13],
    [22, 23],
    [19, 26],
    [13, 24],
    [13, 17],
  ],
  "jade",
);
rect("coat-shadow", 17, 16, 4, 9, "teal");
rect("head-shadow", 16, 6, 7, 7, "skinShade");
rect("face", 19, 7, 5, 6, "skin");
rect("eye", 22, 8, 1, 1, "red");
rect("hood", 15, 5, 7, 3, "cloth");
rect("hood-side", 15, 7, 3, 6, "darkCloth");
poly(
  "sleeve",
  [
    [21, 14],
    [24, 15],
    [25, 23],
    [22, 24],
  ],
  "cloth",
);
rect("hand", 23, 23, 3, 4, "red");
rect("radio-strap", 14, 14, 2, 10, "ink");

sprite(4, "conductor");
rect("far-leg", 20, 24, 4, 7, "violet");
rect("far-boot", 20, 30, 7, 2, "boot");
rect("near-leg", 12, 24, 4, 7, "violet");
rect("near-boot", 10, 30, 7, 2, "boot");
poly(
  "coat-outline",
  [
    [10, 12],
    [24, 12],
    [28, 25],
    [22, 28],
    [18, 24],
    [13, 28],
    [7, 25],
  ],
  "ink",
);
poly(
  "coat",
  [
    [11, 13],
    [23, 13],
    [26, 24],
    [22, 26],
    [18, 23],
    [13, 26],
    [9, 24],
  ],
  "violet",
);
rect("shirt", 16, 13, 5, 10, "boot");
poly(
  "lapel-left",
  [
    [12, 13],
    [16, 13],
    [18, 22],
    [13, 18],
  ],
  "purple",
);
poly(
  "lapel-right",
  [
    [21, 13],
    [24, 13],
    [22, 19],
    [19, 22],
  ],
  "purple",
);
rect("tie", 18, 15, 1, 5, "ink");
rect("far-hand", 26, 22, 3, 5, "skin");
rect("near-hand", 6, 22, 3, 5, "skin");
rect("neck", 17, 10, 4, 4, "skinShade");
rect("face", 15, 5, 8, 7, "skin");
rect("hair", 14, 4, 9, 2, "ink");
rect("visor", 14, 7, 10, 2, "ink");
rect("visor-light", 16, 7, 7, 1, "purple");
rect("earpiece", 13, 7, 2, 4, "ice");
rect("shoulder-left", 9, 12, 6, 2, "purple");
rect("shoulder-right", 23, 12, 4, 2, "purple");

sprite(5, "dragon-gate");
rect("left-plinth", 3, 28, 7, 4, "boot");
rect("right-plinth", 26, 28, 7, 4, "boot");
rect("left-pillar-shadow", 5, 14, 4, 15, "ochre");
rect("left-pillar-light", 5, 15, 2, 13, "light");
rect("right-pillar-shadow", 27, 14, 4, 15, "ochre");
rect("right-pillar-light", 27, 15, 2, 13, "light");
rect("lintel", 4, 13, 28, 4, "ochre");
rect("lintel-gold", 4, 13, 28, 1, "gold");
poly(
  "roof-outline",
  [
    [2, 8],
    [5, 10],
    [10, 4],
    [26, 4],
    [31, 10],
    [34, 8],
    [32, 14],
    [4, 14],
  ],
  "ink",
);
poly(
  "jade-roof",
  [
    [3, 9],
    [6, 11],
    [11, 5],
    [25, 5],
    [30, 11],
    [33, 9],
    [31, 13],
    [5, 13],
  ],
  "teal",
);
for (let x = 10; x <= 25; x += 3) rect(`roof-rib-${x}`, x, 7, 1, 5, "jade");
rect("ridge", 11, 4, 15, 2, "gold");
rect("eaves", 4, 13, 28, 1, "gold");
rect("left-finial", 2, 7, 2, 4, "gold");
rect("right-finial", 32, 7, 2, 4, "gold");
rect("plaque", 13, 14, 10, 4, "ink");
rect("plaque-left", 15, 15, 2, 2, "gold");
rect("plaque-right", 19, 15, 2, 2, "gold");
rect("left-lantern-string", 10, 17, 1, 2, "gold");
rect("left-lantern", 9, 19, 3, 4, "red");
rect("left-lantern-core", 10, 20, 1, 2, "gold");
rect("right-lantern-string", 24, 17, 1, 2, "gold");
rect("right-lantern", 23, 19, 3, 4, "red");
rect("right-lantern-core", 24, 20, 1, 2, "gold");
// An open center and threshold identify an enterable landmark, not a wall.
rect("threshold", 10, 31, 16, 1, "gold");
rect("approach", 16, 27, 4, 2, "gold");

await mkdir("assets/art", { recursive: true });
await mkdir(out, { recursive: true });
await writeFile(
  ".artifacts/people.recipe.json",
  JSON.stringify(ops, null, 2) + "\n",
);
const cli = process.env.SPRITE_CLI;
if (!cli)
  throw Error(
    "Set SPRITE_CLI to the installed sprite.js path; no sprite tool is required for npm run build.",
  );
const env = { ...process.env };
execFileSync(
  process.execPath,
  [cli, "batch", resolve(".artifacts/people.recipe.json")],
  { env, stdio: "inherit" },
);
execFileSync(process.execPath, [cli, "export"], { env, stdio: "inherit" });
const exported = resolve(out, "fogfall-people");
await copyFile(
  resolve(exported, "fogfall-people.png"),
  "assets/art/people.png",
);
await copyFile(
  resolve(exported, "fogfall-people.atlas.json"),
  "assets/art/people.atlas.json",
);
const atlas = JSON.parse(
  await readFile("assets/art/people.atlas.json", "utf8"),
);
atlas.meta.image = "people.png";
await writeFile(
  "assets/art/people.atlas.json",
  JSON.stringify(atlas, null, 2) + "\n",
);
console.log("Exported named people and gate atlas", atlas.meta?.size);
