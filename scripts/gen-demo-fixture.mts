// Recomputes every `raw` in fixtures/demo.json from its score with the engine's K, so the demo's
// assignment preview matches lib/pressure. Re-run after retuning K:
//   node scripts/gen-demo-fixture.mts
// Scores, names and statuses are left as they are. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";
import { K } from "../lib/pressure/config.ts";

const PATH = new URL("../fixtures/demo.json", import.meta.url);

// The fixture stores hidden members as raw only; these are their scores (AP Bio P3's two hidden students; teams show no hidden count below two).
const HIDDEN_SCORES: Record<string, number[]> = { "Product Squad": [], "AP Bio P3": [86, 34] };

const round2 = (n: number) => Math.round(n * 100) / 100;
const scoreOf = (raw: number) => Math.round(100 * (1 - Math.exp(-Math.max(raw, 0) / K)));

/** raw = −K × ln(1 − score/100), rounded to 2 dp and nudged so it maps back to exactly `score`. */
function rawOf(score: number): number {
  let r = round2(-K * Math.log(1 - Math.min(score, 99.5) / 100));
  while (scoreOf(r) < score) r = round2(r + 0.01);
  while (scoreOf(r) > score) r = round2(r - 0.01);
  return r;
}

interface Boiler { name: string; score: number; raw: number }
interface Team { team: { name: string }; boilers: Boiler[]; hiddenCount: number; hiddenRaw: number[] }
interface Contribution { itemId: string; points: number }
interface Demo { teams: Team[]; maya: { result: { score: number; raw: number; contributions: Contribution[] } } }

const demo = JSON.parse(readFileSync(PATH, "utf8")) as Demo;

for (const t of demo.teams) {
  for (const b of t.boilers) b.raw = rawOf(b.score);
  const hidden = HIDDEN_SCORES[t.team.name];
  if (!hidden || hidden.length !== t.hiddenCount) throw new Error(`HIDDEN_SCORES out of date for ${t.team.name}`);
  t.hiddenRaw = hidden.map(rawOf);
}

// Maya: rescale her contributions so they still sum exactly to the new raw.
const r = demo.maya.result;
const newRaw = rawOf(r.score);
const oldSum = r.contributions.reduce((s, c) => s + c.points, 0);
const factor = newRaw / oldSum;
for (const c of r.contributions) c.points = round2(c.points * factor);
const residual = round2(newRaw - r.contributions.reduce((s, c) => s + c.points, 0));
r.contributions[0]!.points = round2(r.contributions[0]!.points + residual);
r.raw = newRaw;

writeFileSync(PATH, JSON.stringify(demo, null, 2) + "\n");
console.log(`K=${K}: Maya raw ${newRaw}, ${demo.teams.map((t) => `${t.team.name} hidden ${t.hiddenRaw.join(",")}`).join("; ")}`);
