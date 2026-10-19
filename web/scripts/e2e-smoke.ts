// End-to-end check of the demo path against a running engine (replay is enough, no model needed):
// three storyline questions must come back as valid responses that light at least one place on the
// map, and a question about an invented professor must be answered honestly with no source.
// Usage: ENGINE_URL=http://127.0.0.1:8104 bun run e2e:smoke

import { groupPlacesByBuilding } from "@/features/world/buildings";
import { lightUp } from "@/features/world/light";
import { PLACES } from "@/features/world/places";
import { createEngineClient } from "@/infrastructure/engine-client";
import { env } from "@/infrastructure/env";

type Check = { id: string; query: string; expect: "lights" | "abstains" };

// From eval/gold.jsonl; a smoke run only reads answers, it tunes nothing.
const CHECKS: readonly Check[] = [
  {
    id: "q001b",
    query:
      "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?",
    expect: "lights",
  },
  {
    id: "q002",
    query:
      "Sensor technology for continuous monitoring of multiple metabolites such as glucose, lactate and ketones",
    expect: "lights",
  },
  {
    id: "q009b",
    query: "Nanopore and PacBio long-read sequencing service in Bern",
    expect: "lights",
  },
  {
    id: "q021",
    query:
      "Prof. Lukas Thalmann heads the PancreaSim digital-twin lab at DCB — what has his team published?",
    expect: "abstains",
  },
];

const engineUrl = env().engineUrl;
if (engineUrl === null) {
  console.error("e2e-smoke needs ENGINE_URL (and DEMO_FIXTURES unset)");
  process.exit(2);
}

const engine = createEngineClient({
  baseUrl: engineUrl,
  fetch: (url, init) => fetch(url, init),
  logError: (message) => console.error(message),
  timeoutMs: 120_000,
});
const buildings = groupPlacesByBuilding(PLACES);

let failures = 0;
for (const check of CHECKS) {
  const answer = await engine.search({ query: check.query });
  if (!answer.ok) {
    failures++;
    console.log(`FAIL ${check.id}  engine answered ${answer.error}`);
    continue;
  }
  const response = answer.value;
  const lit = lightUp(response, buildings).byBuilding.size;
  const passed = check.expect === "lights" ? !response.abstained && lit > 0 : response.abstained;
  if (!passed) failures++;
  const outcome = response.abstained
    ? `abstained (${response.abstain_reason ?? "no reason"})`
    : `${response.results.length} results, ${lit} places lit`;
  console.log(`${passed ? "ok  " : "FAIL"} ${check.id}  ${response.mode}  ${outcome}`);
}

console.log(failures === 0 ? "e2e smoke: all checks passed" : `e2e smoke: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
