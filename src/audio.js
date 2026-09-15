import { PATCHES, selectCues } from "./audio-cues.js";
import { createTransport } from "./score-transport.js";

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const noiseBuffers = new WeakMap();

function noiseBuffer(context) {
  if (!noiseBuffers.has(context)) {
    const buffer = context.createBuffer(
      1,
      context.sampleRate,
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    // Local deterministic texture: never consume the expedition's RNG.
    let seed = 0x51f15e;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = (seed >>> 0) / 0x80000000 - 1;
    }
    noiseBuffers.set(context, buffer);
  }
  return noiseBuffers.get(context);
}

export function duckMusic(gain, now, duration) {
  gain.cancelAndHoldAtTime(now);
  // Anchor the start: without this, a first ramp also attenuates the preceding
  // music when rendered offline (and can ramp from an older automation point).
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(0.2, now + 0.012);
  gain.setTargetAtTime(0.65, now + duration, 0.18);
}

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
    const isNoise = note.type === "noise";
    const oscillator = isNoise
      ? context.createBufferSource()
      : context.createOscillator();
    const gain = context.createGain();
    const start = when + note.at,
      end = start + note.duration;
    let filter;
    if (isNoise) {
      oscillator.buffer = noiseBuffer(context);
      oscillator.loop = true;
      filter = context.createBiquadFilter();
      filter.type = note.filter;
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(note.frequency, start);
      filter.frequency.exponentialRampToValueAtTime(note.endFrequency, end);
      oscillator.connect(filter);
      filter.connect(gain);
    } else {
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(hz(note.midi), start);
      oscillator.frequency.exponentialRampToValueAtTime(
        hz(note.end ?? note.midi),
        end,
      );
      oscillator.connect(gain);
    }
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      note.gain,
      start + Math.min(note.attack ?? 0.012, note.duration / 2),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.gain.linearRampToValueAtTime(0, end + 0.008);
    gain.connect(destination);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter?.disconnect();
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
    music,
    transport,
    scene = null,
    lifecycle = 0,
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
    lifecycle++;
    transport?.stop();
    clear();
    if (master) master.gain.value = 0;
    context?.suspend().catch(() => {});
  }
  async function ready() {
    if (!context || context.state === "closed") {
      context = createContext();
      if (!context) return false;
      master = context.createGain();
      master.connect(context.destination);
      music = context.createGain();
      music.gain.value = 0.65;
      music.connect(master);
      transport = createTransport({
        context,
        schedule: (notes, when, done) =>
          schedulePatch(context, music, notes, when, done),
      });
      const observed = context;
      context.addEventListener("statechange", () => {
        if (context !== observed) return;
        if (context.state !== "running") {
          transport.stop();
          // A delayed 'suspended' notification can arrive during a NEW resume.
          // Stop old voices without invalidating that newer scene/request.
          if (context.state === "interrupted" || context.state === "closed")
            clear();
          else {
            for (const group of active) group.stop();
            active.clear();
          }
        } else if (scene && enabled && !isHidden()) {
          master.gain.value = 0.8;
          transport.update(scene);
        }
      });
    }
    if (context.state !== "running") await context.resume();
    return context.state === "running";
  }
  async function resume() {
    if (!scene || !enabled || isHidden()) return;
    const ticket = lifecycle;
    try {
      if (
        !(await ready()) ||
        ticket !== lifecycle ||
        !enabled ||
        isHidden() ||
        !scene
      )
        return;
      master.gain.value = 0.8;
      transport.update(scene);
    } catch {
      // Retry on the next gesture if the browser cannot resume audio yet.
    }
  }
  return {
    setEnabled(value) {
      enabled = value;
      if (!enabled) suspend();
      else return resume();
    },
    suspend,
    resume,
    setScene(next) {
      if (!next || next.seed !== scene?.seed || next.floor !== scene?.floor) {
        lifecycle++;
        transport?.stop();
      }
      scene = next ? { ...next } : null;
      return resume();
    },
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
        if (!(await ready())) return;
        if (
          !enabled ||
          isHidden() ||
          ticket !== epoch ||
          context.state !== "running"
        )
          return;
        master.gain.value = 0.8;
        if (scene) transport.update(scene);
        if (selected[0] !== "focus") {
          const now = context.currentTime;
          const duration = Math.max(
            ...selected.flatMap((id, i) =>
              PATCHES[id].map((n) => i * 0.18 + n.at + n.duration),
            ),
          );
          duckMusic(music.gain, now, duration);
        }
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
