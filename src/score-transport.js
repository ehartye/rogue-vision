import { composeBar, SLOT_SECONDS } from "./score.js";

// JS decides what to schedule; the audio clock decides when it sounds.
// Only 100ms is committed ahead. A delayed tick skips missed slots in O(1).
export function createTransport({
  context,
  schedule,
  setTimer = setInterval,
  clearTimer = clearInterval,
}) {
  let state = null,
    timer = null,
    nextAt = 0,
    slot = 0;
  const active = new Set();
  function stop() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    for (const group of active) group.stop();
    active.clear();
  }
  function tick() {
    if (context.state !== "running" || !state) {
      stop();
      return;
    }
    const now = context.currentTime;
    if (nextAt < now) {
      const missed = Math.ceil((now - nextAt) / SLOT_SECONDS);
      slot += missed;
      nextAt += missed * SLOT_SECONDS;
    }
    try {
      while (nextAt < now + 0.1) {
        const notes = composeBar(state, Math.floor(slot / 8))
          .filter((n) => Math.abs(n.at - (slot % 8) * SLOT_SECONDS) < 1e-6)
          .map((n) => ({ ...n, at: 0 }));
        if (notes.length) {
          const group = schedule(notes, nextAt, () => active.delete(group));
          active.add(group);
        }
        nextAt += SLOT_SECONDS;
        slot++;
      }
    } catch {
      // Device/scheduling failures must not escape a timer into gameplay.
      stop();
    }
  }
  return {
    stop,
    update(next) {
      if (!next) {
        state = null;
        stop();
        return;
      }
      if (!state || next.seed !== state.seed || next.floor !== state.floor)
        stop();
      state = { ...next };
      if (timer !== null || context.state !== "running") return;
      slot = 0;
      nextAt = context.currentTime + 0.05;
      timer = setTimer(tick, 25);
      tick();
    },
  };
}
