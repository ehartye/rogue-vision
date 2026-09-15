// D–A–E: a signal searching for its home. Victory finally answers with D.
export const SIGNAL = [74, 81, 76];
const note = (
  midi,
  duration = 0.12,
  at = 0,
  gain = 0.045,
  type = "triangle",
  end = midi,
) => ({ midi, duration, at, gain, type, end });
const signal = (duration = 0.24) =>
  SIGNAL.map((midi, i) => note(midi, duration, i * 0.19));
const impact = (frequency, endFrequency, duration, gain, at = 0) => ({
  type: "noise",
  filter: "bandpass",
  frequency,
  endFrequency,
  duration,
  gain,
  at,
  attack: 0.003,
});
const strike = (midi, end, duration, gain, at = 0, type = "triangle") => ({
  ...note(midi, duration, at, gain, type, end),
  attack: 0.003,
});

export const PATCHES = {
  focus: [note(74, 0.045, 0, 0.015, "sine")],
  move: [note(62, 0.05, 0, 0.018, "triangle", 60)],
  wait: [note(69, 0.09, 0, 0.014, "sine")],
  hit: [
    strike(74, 49, 0.13, 0.065),
    impact(2300, 650, 0.095, 0.06),
    strike(86, 64, 0.035, 0.016, 0, "square"),
  ],
  damage: [
    strike(70, 48, 0.23, 0.065),
    impact(1500, 400, 0.18, 0.065),
    strike(77, 60, 0.085, 0.023, 0.045, "square"),
  ],
  blocked: [note(60, 0.06), note(59, 0.09, 0.09)],
  warning: [
    note(81, 0.075, 0, 0.028, "square"),
    note(82, 0.12, 0.12, 0.028, "square"),
  ],
  pulse: [
    note(62, 0.065, 0, 0.035, "triangle", 81),
    strike(86, 50, 0.32, 0.065, 0.065),
    impact(3600, 550, 0.31, 0.055, 0.065),
    strike(81, 69, 0.2, 0.02, 0.11, "sine"),
  ],
  kill: [
    strike(78, 48, 0.19, 0.06),
    impact(2800, 800, 0.15, 0.065),
    strike(86, 74, 0.11, 0.025, 0.055, "square"),
  ],
  shot: [
    strike(88, 57, 0.12, 0.038, 0, "sawtooth"),
    impact(3200, 1000, 0.07, 0.04),
  ],
  blast: [
    strike(76, 48, 0.35, 0.065),
    impact(1800, 300, 0.33, 0.07),
    strike(69, 50, 0.21, 0.023, 0.065, "square"),
  ],
  pickup: [note(74, 0.12), note(81, 0.2, 0.12)],
  trade: [note(69, 0.12), note(74, 0.18, 0.12), note(81, 0.24, 0.26)],
  leave: [
    note(76, 0.12, 0, 0.022, "sine"),
    note(74, 0.12, 0.12, 0.022, "sine"),
  ],
  landmark: [
    note(81, 0.22, 0, 0.035, "sine"),
    note(76, 0.3, 0.23, 0.035, "sine"),
  ],
  arrival: signal(),
  uplink: [...signal(), note(81, 0.55, 0.62, 0.04, "sine")],
  won: [
    ...signal(),
    note(78, 0.26, 0.6),
    note(81, 0.3, 0.86),
    note(86, 1.1, 1.2, 0.05, "sine"),
  ],
  dead: [
    note(74, 0.28),
    note(69, 0.32, 0.22),
    note(63, 0.65, 0.5, 0.04, "triangle", 62),
  ],
};

// Preserve semantic outcomes in the game; control density here. A turn can
// sound at most three cues, with fatalities/cadences replacing other chatter.
export function selectCues(events) {
  const has = new Set(events);
  for (const terminal of ["dead", "won", "uplink"])
    if (has.has(terminal)) return [terminal];
  const important = [
    "damage",
    "warning",
    "pulse",
    "kill",
    "blast",
    "shot",
    "trade",
    "pickup",
    "arrival",
    "landmark",
    "blocked",
    "leave",
  ].filter((id) => has.has(id));
  if (important.length) return important.slice(0, 3);
  return ["hit", "move", "wait", "focus"]
    .filter((id) => has.has(id))
    .slice(0, 1);
}
