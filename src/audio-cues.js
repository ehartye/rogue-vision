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

export const PATCHES = {
  focus: [note(74, 0.045, 0, 0.015, "sine")],
  move: [note(62, 0.05, 0, 0.018, "triangle", 60)],
  wait: [note(69, 0.09, 0, 0.014, "sine")],
  hit: [
    note(64, 0.085, 0, 0.04, "triangle", 53),
    note(83, 0.04, 0, 0.012, "square", 71),
  ],
  damage: [
    note(67, 0.17, 0, 0.045, "triangle", 60),
    note(73, 0.11, 0.025, 0.018, "square", 66),
  ],
  blocked: [note(60, 0.06), note(59, 0.09, 0.09)],
  warning: [
    note(81, 0.075, 0, 0.028, "square"),
    note(82, 0.12, 0.12, 0.028, "square"),
  ],
  pulse: [
    note(62, 0.3, 0, 0.05, "triangle", 81),
    note(86, 0.24, 0.08, 0.025, "sine", 74),
  ],
  kill: [note(81, 0.09), note(86, 0.2, 0.1)],
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
