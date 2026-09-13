import { KITS } from "./kits.js";
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const validId = (v) => typeof v === "string" && v.length > 0 && v.length <= 100;
const receipt = (r) =>
  r === null ||
  (r &&
    validId(r.id) &&
    count(r.kills) &&
    count(r.districts) &&
    r.districts <= 4 &&
    typeof r.won === "boolean");
const clears = (run) =>
  run.floor + (["upgrade", "won"].includes(run.phase) ? 1 : 0);
export function newProfile(legacy = {}) {
  return {
    version: 1,
    runs: count(legacy?.runs) ? legacy.runs : 0,
    wins: count(legacy?.wins) ? legacy.wins : 0,
    best: count(legacy?.best) ? legacy.best : 0,
    kills: 0,
    districts: 0,
    current: null,
    previous: null,
  };
}
export function readProfile(raw, legacy = {}) {
  if (raw === null || raw === undefined)
    return { profile: newProfile(legacy), recovered: false };
  try {
    const p = JSON.parse(raw),
      r = p?.current;
    if (
      p?.version !== 1 ||
      !["runs", "wins", "best", "kills", "districts"].every((k) =>
        count(p[k]),
      ) ||
      !receipt(r) ||
      !receipt(p.previous ?? null)
    )
      throw Error("Invalid profile");
    return { profile: p, recovered: false };
  } catch {
    return { profile: newProfile(legacy), recovered: true };
  }
}
export function trackRun(p, run, isNew = true) {
  if (!validId(run.id) || p.current?.id === run.id) return false;
  // Keep the durable receipt through any number of failed replacement saves.
  p.previous ??= p.current;
  p.current = { id: run.id, kills: 0, districts: 0, won: false };
  if (isNew) p.runs++;
  // Old terminal saves already contributed to legacy win totals.
  if (!isNew && run.phase === "won") p.current.won = true;
  return true;
}
export function acknowledgeRun(p, run) {
  if (p.current?.id === run.id) p.previous = null;
}
export function resumeRun(p, run) {
  if (p.current?.id === run.id) {
    p.previous = null;
    return true;
  }
  if (p.previous?.id === run.id) {
    p.current = p.previous;
    p.previous = null;
    return true;
  }
  if (!p.current) {
    trackRun(p, run, false);
    return true;
  }
  // An unrelated imported snapshot has no receipt. Credit future deltas only.
  p.current = {
    id: run.id,
    kills: run.kills,
    districts: clears(run),
    won: run.phase === "won",
  };
  p.previous = null;
  return false;
}
export function creditRun(p, run) {
  const r = p.current;
  if (!r || r.id !== run.id) return false;
  const districts = clears(run);
  p.kills += Math.max(0, run.kills - r.kills);
  r.kills = Math.max(r.kills, run.kills);
  p.districts += Math.max(0, districts - r.districts);
  r.districts = Math.max(r.districts, districts);
  if (run.phase === "won" && !r.won) {
    p.wins++;
    r.won = true;
  }
  p.best = Math.max(p.best, run.score);
  return true;
}
export function kitUnlocked(p, id) {
  if (!Object.hasOwn(KITS, id)) return false;
  const goal = KITS[id].goal;
  return !goal || p[goal.stat] >= goal.target;
}
export function unlockProgress(p, id) {
  const goal = KITS[id]?.goal;
  return !goal || kitUnlocked(p, id)
    ? "Ready"
    : `${Math.min(p[goal.stat], goal.target)}/${goal.target} ${goal.label}`;
}
