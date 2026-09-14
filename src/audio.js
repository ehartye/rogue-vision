import { PATCHES, selectCues } from "./audio-cues.js";

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// The same native graph serves live playback and OfflineAudioContext renders.
// Each voice owns its attack/release and disconnects after its scheduled stop.
export function schedulePatch(
  context,
  destination,
  patch,
  when,
  onEnded = () => {},
) {
  const voices = new Set();
  for (const note of patch) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = when + note.at,
      end = start + note.duration;
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(hz(note.midi), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      hz(note.end ?? note.midi),
      end,
    );
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      note.gain,
      start + Math.min(0.012, note.duration / 4),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.gain.linearRampToValueAtTime(0, end + 0.008);
    oscillator.connect(gain);
    gain.connect(destination);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(voice);
      if (!voices.size) onEnded();
    };
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }
  return {
    stop() {
      const now = context.currentTime;
      for (const { oscillator, gain } of voices) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        oscillator.stop(now);
      }
    },
  };
}

export function createAudio({
  createContext = () => {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Audio ? new Audio() : null;
  },
  isHidden = () => globalThis.document?.hidden ?? false,
} = {}) {
  let context,
    master,
    enabled = false,
    epoch = 0,
    pending = false;
  const active = new Set();
  function clear() {
    epoch++;
    pending = false;
    for (const group of active) group.stop();
    active.clear();
  }
  function suspend() {
    clear();
    if (master) master.gain.value = 0;
    context?.suspend().catch(() => {});
  }
  return {
    setEnabled(value) {
      enabled = value;
      if (!enabled) suspend();
    },
    suspend,
    async play(events) {
      if (!enabled || isHidden()) return;
      const selected = selectCues(events);
      if (!selected.length) return;
      // Swiping a results/upgrade menu must not steal the cadence's last note.
      if (selected[0] === "focus" && (active.size || pending)) return;
      clear();
      const ticket = epoch;
      pending = true;
      try {
        if (!context || context.state === "closed") {
          context = createContext();
          if (!context) return;
          master = context.createGain();
          master.connect(context.destination);
        }
        if (context.state !== "running") await context.resume();
        if (
          !enabled ||
          isHidden() ||
          ticket !== epoch ||
          context.state !== "running"
        )
          return;
        master.gain.value = 0.8;
        selected.forEach((id, i) => {
          const group = schedulePatch(
            context,
            master,
            PATCHES[id],
            context.currentTime + 0.005 + i * 0.18,
            () => active.delete(group),
          );
          active.add(group);
        });
      } catch {
        // Audio is optional. A failed device/context must never block a turn.
      } finally {
        if (ticket === epoch) pending = false;
      }
    },
  };
}
