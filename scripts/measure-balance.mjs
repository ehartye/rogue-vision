import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { simulate, replay } from "./balance/simulation.mjs";
import { POLICY_VERSION } from "./balance/policies.mjs";
import {
  parseArgs,
  summarize,
  summarizeUpgrades,
  unlockSession,
  markdown,
} from "./balance/report.mjs";

try {
  const inputs = parseArgs(process.argv.slice(2));
  if (inputs.help) {
    console.log(
      "npm run balance -- [--runs 30] [--seed 1] [--max-turns 400] [--kits courier,relay,breaker] [--policies direct,scavenger,tactical] [--forks] [--sessions 5] [--session-runs 10] [--output .artifacts/balance]\nReplay: --replay <report.json> --row <zero-based-index>",
    );
  } else if (inputs.replay) {
    const report = JSON.parse(await readFile(inputs.replay, "utf8"));
    const row = report.rows?.[inputs.row];
    if (!row) throw Error("Replay row out of range");
    console.log(JSON.stringify(replay(row), null, 2));
  } else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const dirty = !!execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const hash = createHash("sha256");
    for (const path of [
      "src/game.js",
      "src/districts.js",
      "src/kits.js",
      "src/profile.js",
      "scripts/balance/policies.mjs",
      "scripts/balance/simulation.mjs",
      "scripts/balance/report.mjs",
      "scripts/measure-balance.mjs",
    ]) {
      hash.update(path);
      hash.update(await readFile(join(root, path)));
    }
    const rows = [],
      sessions = [];
    for (const policy of inputs.policies)
      for (const kit of inputs.kits) {
        for (let index = 0; index < inputs.runs; index++)
          rows.push(
            simulate({
              ...inputs,
              policy,
              kit,
              seed: (inputs.seed + index) >>> 0,
            }),
          );
        console.error(`Measured ${kit}/${policy}: ${inputs.runs} seeds`);
      }
    for (const policy of inputs.policies)
      for (let index = 0; index < inputs.sessions; index++) {
        sessions.push(
          unlockSession({
            ...inputs,
            policy,
            seed: (inputs.seed + index * inputs.sessionRuns) >>> 0,
          }),
        );
      }
    const report = {
      schemaVersion: 1,
      revision,
      dirty,
      sourceFingerprint: hash.digest("hex"),
      policyVersion: POLICY_VERSION,
      inputs,
      rows,
      summaries: summarize(rows),
      upgradeSummaries: summarizeUpgrades(rows),
      sessions,
    };
    const output = resolve(inputs.output);
    await mkdir(output, { recursive: true });
    await writeFile(
      join(output, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    const summary = markdown(report);
    await writeFile(join(output, "report.md"), summary);
    console.log(summary);
    console.error(`Saved ${join(output, "report.json")}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
