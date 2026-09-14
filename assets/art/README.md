# FOGFALL gameplay art

The people use named parametric shapes authored through the MIT-licensed
[claude-sprites](https://github.com/ehartye/claude-sprites) standalone CLI (verified
with v0.10.0). The source of truth is `scripts/author-people.mjs`. It emits a
batch recipe into `.artifacts/people.recipe.json`, exports the sheet and Aseprite
metadata, and copies the production files here. No model-specific tool is needed
to run the recipe. The authoring server and its native modules are optional;
ordinary builds and gameplay use the committed PNGs.

All cells are 36×36, untrimmed, top-left aligned. Named frames: `courier`, `husk`,
`runner`, `relay`, `conductor`, `dragon-gate`. Actors share a foot baseline at
y=31 and have separate head, torso, arms and legs. Every frame is used; numeric
frame aliases in the exported metadata describe the same six cells. No animation
is implied by the atlas durations. The spitter engine ID uses the `relay` frame.

`source/chinatown-frontage.png` is the original AI-generated static storefront
(OpenAI image generation, 2026-09-14). The brief was a tightly framed frontal
Chinatown shop, jade roof, amber windows, restrained teal facade, one lantern,
chunky pixels and no text or people. `scripts/prepare-frontage.mjs` compiles that
source to the 36×36 runtime tile without smoothing. The full source is retained
for editing but is neither deployed nor cached by the game.

PowerShell authoring commands, from the repo root with the sprite server running:

```powershell
$env:SPRITE_CLI='C:/path/to/claude-sprites/scripts/sprite.js'
$env:SPRITE_PORT='3387'
node scripts/author-people.mjs
node scripts/prepare-frontage.mjs
npm run build
```

Use a dedicated server port and a new project; don't replace another artist's
active session. The CLI can start its server automatically. Inspect the exports
at native size after each revision. Keep silhouettes inside their cells and
leave room for the renderer's health, stun and threat marks. Rendered wall art
must never spill into a walkable cell. Runtime art loading has vector fallbacks.
