import { KITS } from "../../src/kits.js";
import { newRun } from "../../src/game.js";
import {
  newProfile,
  trackRun,
  acknowledgeRun,
  creditRun,
  kitUnlocked,
} from "../../src/profile.js";
import { POLICIES } from "./policies.mjs";
import { simulate } from "./simulation.mjs";

export function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length)
    return {
      n: 0,
      mean: null,
      p10: null,
      median: null,
      p90: null,
      min: null,
      max: null,
    };
  const percentile = (p) => sorted[Math.floor((sorted.length - 1) * p)];
  return {
    n: sorted.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p10: percentile(0.1),
    median: percentile(0.5),
    p90: percentile(0.9),
    min: sorted[0],
    max: sorted.at(-1),
  };
}

export function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.kit}/${row.policy}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map((group) => {
    const outcomes = { won: 0, dead: 0, capped: 0, stalled: 0 };
    for (const r of group) outcomes[r.outcome]++;
    const metrics = Object.fromEntries(
      [
        "turns",
        "hp",
        "score",
        "kills",
        "damageTaken",
        "healing",
        "healingWasted",
        "hullSpent",
      ].map((k) => [k, distribution(group.map((r) => r[k]))]),
    );
    return {
      kit: group[0].kit,
      policy: group[0].policy,
      n: group.length,
      outcomes,
      observedWinFraction: outcomes.won / group.length,
      unresolvedFraction: (outcomes.capped + outcomes.stalled) / group.length,
      metrics,
      districts: [1, 2, 3, 4].map((number) => {
        const entered = group.flatMap((r) =>
          r.districts
            .filter((d) => d.district === number)
            .map((d) => ({ ...d, outcome: r.outcome })),
        );
        const cleared = entered.filter((d) => d.cleared).length;
        return {
          district: number,
          entered: entered.length,
          cleared,
          deaths: entered.filter((d) => !d.cleared && d.outcome === "dead")
            .length,
          unresolved: entered.filter(
            (d) => !d.cleared && ["capped", "stalled"].includes(d.outcome),
          ).length,
          clearFraction: entered.length ? cleared / entered.length : null,
          metrics: Object.fromEntries(
            [
              "turns",
              "damageTaken",
              "healing",
              "healingWasted",
              "minHp",
              "entryHp",
              "exitHp",
              "emptyChargeTurns",
              "exposedTurns",
              "threatenedTurns",
              "kills",
            ].map((k) => [k, distribution(entered.map((d) => d[k]))]),
          ),
          pickups: Object.fromEntries(
            ["med", "cell", "signal"].map((k) => [
              k,
              distribution(entered.map((d) => d.pickups[k])),
            ]),
          ),
          encounters: {
            take: entered.reduce(
              (n, d) => n + d.encounters.filter((c) => c === "take").length,
              0,
            ),
            leave: entered.reduce(
              (n, d) => n + d.encounters.filter((c) => c === "leave").length,
              0,
            ),
          },
        };
      }),
    };
  });
}

export function summarizeUpgrades(rows) {
  const comparisons = [];
  for (const row of rows)
    for (const checkpoint of row.upgradeComparisons) {
      const baseline = checkpoint.alternatives.find(
        (a) => a.choice === checkpoint.selected,
      )?.result;
      if (!baseline) throw Error("Missing selected upgrade baseline");
      for (const alternative of checkpoint.alternatives) {
        if (alternative.choice === checkpoint.selected) continue;
        const other = alternative.result;
        const settled = [baseline, other].every((r) =>
          ["won", "dead"].includes(r.outcome),
        );
        comparisons.push({
          kit: row.kit,
          policy: row.policy,
          district: checkpoint.district,
          build: checkpoint.relics.join("+") || "none",
          choice: alternative.choice,
          against: checkpoint.selected,
          settled,
          winDelta: settled
            ? Number(other.outcome === "won") -
              Number(baseline.outcome === "won")
            : null,
          winningHpDelta:
            other.outcome === "won" && baseline.outcome === "won"
              ? other.hp - baseline.hp
              : null,
        });
      }
    }
  const groups = new Map();
  for (const c of comparisons) {
    const key = [
      c.kit,
      c.policy,
      c.district,
      c.build,
      c.choice,
      c.against,
    ].join("/");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.values()].map((group) => {
    const { kit, policy, district, build, choice, against } = group[0];
    return {
      kit,
      policy,
      district,
      build,
      choice,
      against,
      n: group.length,
      unsettledPairs: group.filter((c) => !c.settled).length,
      winDelta: distribution(group.map((c) => c.winDelta)),
      winningHpDelta: distribution(group.map((c) => c.winningHpDelta)),
    };
  });
}

export function unlockSession({
  seed = 1,
  policy = "tactical",
  maxTurns = 400,
  sessionRuns = 10,
}) {
  const profile = newProfile(),
    unlocks = {},
    runs = [];
  for (
    let index = 0;
    index < sessionRuns && Object.keys(unlocks).length < 2;
    index++
  ) {
    const s = newRun((seed + index) >>> 0, "courier");
    s.id = `balance:${seed}:${index}`;
    trackRun(profile, s);
    acknowledgeRun(profile, s);
    runs.push(
      simulate({
        state: s,
        policy,
        maxTurns,
        onStep: (current) => {
          creditRun(profile, current);
          for (const kit of ["relay", "breaker"])
            if (!unlocks[kit] && kitUnlocked(profile, kit)) {
              unlocks[kit] = {
                run: index + 1,
                turn: current.turn,
                kills: profile.kills,
                districts: profile.districts,
              };
            }
        },
      }),
    );
  }
  return {
    seed,
    policy,
    startingKit: "courier",
    sessionRuns,
    maxTurns,
    unlocks,
    profile,
    runs,
    complete: Object.keys(unlocks).length === 2,
  };
}

export function parseArgs(args) {
  const result = {
    runs: 30,
    seed: 1,
    maxTurns: 400,
    policies: [...POLICIES],
    kits: Object.keys(KITS),
    sessions: 5,
    sessionRuns: 10,
    forks: false,
    output: ".artifacts/balance",
    row: 0,
  };
  const numbers = {
    "--runs": ["runs", 1, 10000],
    "--seed": ["seed", 0, 4294967295],
    "--max-turns": ["maxTurns", 1, 100000],
    "--sessions": ["sessions", 0, 1000],
    "--session-runs": ["sessionRuns", 1, 1000],
    "--row": ["row", 0, 10000000],
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--forks", "--help"].includes(arg)) {
      result[arg.slice(2)] = true;
      continue;
    }
    if (
      !(arg in numbers) &&
      !["--policies", "--kits", "--output", "--replay"].includes(arg)
    )
      throw Error(`Unknown argument: ${arg}`);
    const value = args[++i];
    if (!value || value.startsWith("--"))
      throw Error(`Missing value for ${arg}`);
    if (arg in numbers) {
      const [key, min, max] = numbers[arg],
        number = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(number) ||
        number < min ||
        number > max
      )
        throw Error(`Invalid ${arg}: ${value}`);
      result[key] = number;
    } else if (["--policies", "--kits"].includes(arg)) {
      const allowed = arg === "--policies" ? POLICIES : Object.keys(KITS),
        values = value.split(",");
      if (
        values.some((v) => !allowed.includes(v)) ||
        new Set(values).size !== values.length
      )
        throw Error(`Invalid ${arg}: ${value}`);
      result[arg.slice(2)] = values;
    } else result[arg.slice(2)] = value;
  }
  return result;
}

export function markdown(report) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  const lines = [
    "# FOGFALL balance experiment",
    "",
    `Revision: \`${report.revision}\` (working tree ${report.dirty ? "dirty" : "clean"}); source fingerprint: \`${report.sourceFingerprint}\`.`,
    "",
    `Policy version ${report.policyVersion}; ${report.rows.length} primary runs; seeds start at ${report.inputs.seed}; turn cap ${report.inputs.maxTurns}.`,
    "",
    "Bots are reproducible strategy probes, not calibrated human skill levels. Unfinished runs are not losses. Distributions include capped observations and do not estimate full run lifetimes. No difficulty constants were changed.",
    "",
    "| Kit | Policy | Runs | Wins | Deaths | Capped | Stalled | Observed wins | Mean damage |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const s of report.summaries)
    lines.push(
      `| ${s.kit} | ${s.policy} | ${s.n} | ${s.outcomes.won} | ${s.outcomes.dead} | ${s.outcomes.capped} | ${s.outcomes.stalled} | ${pct(s.observedWinFraction)} | ${s.metrics.damageTaken.mean.toFixed(1)} |`,
    );
  lines.push(
    "",
    "## District pressure",
    "",
    "Clearance uses runs that entered that district as its denominator; later districts select for survivors. Minimum hull is sampled after actions. Upgrade recovery is stored separately in raw transcripts.",
    "",
    "| Kit / policy | District | Entered | Cleared | Died | Unresolved | Median minimum hull | Mean damage | Mean turns |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const s of report.summaries)
    for (const d of s.districts)
      lines.push(
        `| ${s.kit} / ${s.policy} | ${d.district} | ${d.entered} | ${d.cleared} | ${d.deaths} | ${d.unresolved} | ${d.metrics.minHp.median ?? "—"} | ${d.metrics.damageTaken.mean?.toFixed(1) ?? "—"} | ${d.metrics.turns.mean?.toFixed(1) ?? "—"} |`,
      );
  lines.push(
    "",
    "## Upgrade comparisons",
    "",
    `${report.upgradeSummaries.length} contextual comparison groups. Full paired results are in report.json: kit, policy, district, preceding build, alternative and selected baseline. Win deltas exclude pairs with any unresolved ending; hull deltas include pairs where both win. These comparisons describe this continuation policy, not universal item rankings.`,
  );
  if (report.upgradeSummaries.length) {
    lines.push(
      "",
      "The twelve most frequently sampled contexts (not an item ranking):",
      "",
      "| Kit / policy | District / prior build | Alternative vs selected | Pairs | Unresolved pairs | Win difference in settled pairs |",
      "|---|---|---|---:|---:|---:|",
    );
    for (const s of [...report.upgradeSummaries]
      .sort((a, b) => b.n - a.n)
      .slice(0, 12)) {
      lines.push(
        `| ${s.kit} / ${s.policy} | ${s.district} / ${s.build} | ${s.choice} vs ${s.against} | ${s.n} | ${s.unsettledPairs} | ${s.winDelta.mean === null ? "—" : (s.winDelta.mean * 100).toFixed(1) + " pp"} |`,
      );
    }
  }
  lines.push(
    "",
    "## Unlock pacing",
    "",
    "Every session starts with a fresh profile and stays on Courier. Capped/stalled expeditions are explicitly abandoned before the next run; their earned progress is retained by production profile rules. Missing unlocks are censored at the session limit.",
    "",
    "| Policy | Sessions | Relay reached | Median run when reached | Breaker reached | Median run when reached |",
    "|---|---:|---:|---:|---:|---:|",
  );
  for (const policy of report.inputs.policies) {
    const sessions = report.sessions.filter((s) => s.policy === policy);
    const relay = distribution(sessions.map((s) => s.unlocks.relay?.run)),
      breaker = distribution(sessions.map((s) => s.unlocks.breaker?.run));
    lines.push(
      `| ${policy} | ${sessions.length} | ${relay.n} | ${relay.median ?? "—"} | ${breaker.n} | ${breaker.median ?? "—"} |`,
    );
  }
  lines.push(
    "",
    "## Replay",
    "",
    "Use `npm run balance -- --replay <report.json> --row <zero-based-index>` for a primary run. The JSON also preserves each upgrade continuation and unlock-session run with its initial save, accepted action transcript and final state digest.",
    "",
  );
  return lines.join("\n");
}
