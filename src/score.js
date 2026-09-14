import { SIGNAL } from "./audio-cues.js";

export const BPM = 72;
export const SLOT_SECONDS = 60 / BPM / 2;
export const BAR_SECONDS = SLOT_SECONDS * 8;

// Authored voicings and replies, recombined within the same D-centred signal.
// One bar in four leaves the melody silent. No continuous urgency ramp.
const DISTRICT_VOICES = [
  {
    name: "Embarcadero",
    register: -12,
    type: "sine",
    chords: [
      [62, 69],
      [65, 72],
      [62, 76],
      [67, 74],
    ],
    steps: [0, 3, 6],
  },
  {
    name: "Chinatown",
    register: 0,
    type: "triangle",
    chords: [
      [62, 69],
      [67, 74],
      [65, 72],
      [64, 71],
    ],
    steps: [0, 2, 6],
  },
  {
    name: "Market Street",
    register: -12,
    type: "triangle",
    chords: [
      [62, 69],
      [60, 67],
      [65, 72],
      [62, 76],
    ],
    steps: [0, 3, 7],
  },
  {
    name: "Moscone",
    register: -12,
    type: "triangle",
    chords: [
      [62, 69],
      [58, 65],
      [60, 67],
      [62, 68],
    ],
    steps: [0, 4, 6],
  },
];
const REPLIES = [
  [76, 74, 69],
  [81, 79, 76],
  [74, 76, 79],
  [79, 76, 74],
];
const ECHOES = [
  [81, 76],
  [79, 74],
  [76, 69],
  [74, 81],
];
function choice(seed, floor, phrase) {
  // A private hash, never the simulation's random stream.
  let n =
    (seed ^
      Math.imul(floor + 1, 0x9e3779b9) ^
      Math.imul(phrase + 1, 0x85ebca6b)) >>>
    0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return (n ^ (n >>> 15)) >>> 0;
}

export function musicState(run) {
  if (!run || run.phase !== "playing") return null;
  const visible = run.enemies.filter((e) => run.visible[e.y]?.[e.x]);
  const threatened = visible.some((e) =>
    e.intent.some((p) => p.x === run.player.x && p.y === run.player.y),
  );
  const pressure = Math.min(
    2,
    +(visible.length > 0) +
      +(threatened || run.player.hp / run.player.maxHp < 0.35),
  );
  return { seed: run.seed, floor: run.floor, pressure };
}

export function composeBar(state, bar) {
  const voice = DISTRICT_VOICES[state.floor];
  const phrase = Math.floor(bar / 4),
    part = bar % 4;
  const variant = choice(state.seed, state.floor, phrase);
  const chord = voice.chords[(phrase + (variant % 2)) % voice.chords.length];
  const notes = chord.map((midi) => ({
    role: "room",
    midi,
    at: 0,
    duration: part === 3 ? 1.4 : 1.9,
    gain: 0.012,
    type: "sine",
    attack: 0.24,
  }));
  const line =
    part === 0
      ? SIGNAL
      : part === 1
        ? REPLIES[variant % 4]
        : part === 2
          ? ECHOES[(variant + phrase) % 4]
          : [];
  line.forEach((midi, i) =>
    notes.push({
      role: "signal",
      midi: midi + voice.register,
      at: voice.steps[i] * SLOT_SECONDS,
      duration: state.floor === 1 ? 0.55 : 0.8,
      gain: 0.022,
      type: voice.type,
    }),
  );
  if (state.pressure && part !== 3) {
    // Pressure adds a restrained broken pulse, never changes tempo.
    for (const step of state.pressure === 2 ? [2, 5] : [5])
      notes.push({
        role: "pulse",
        midi: 62,
        at: step * SLOT_SECONDS,
        duration: 0.1,
        gain: 0.014,
        type: "triangle",
      });
    if (state.pressure === 2)
      notes.push({
        role: "tension",
        midi: state.floor === 3 ? 68 : 71,
        at: 4 * SLOT_SECONDS,
        duration: 0.65,
        gain: 0.01,
        type: "sine",
        attack: 0.1,
      });
  }
  return notes.sort((a, b) => a.at - b.at);
}
