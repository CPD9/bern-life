// Two results of the Apertus red-team experiment (CPD9/apertus-redteam-graph, Apache-2.0): why
// the Navigator treats a question's premise as a claim to check. That repository is private, so
// each row names its files instead of linking them. Both values were checked against
// track_1a/docs/audit/stats.json and track_1a/technical_report.md:
// - "mitigation" (runs 20261017-140533-a21a without and 20261017-144423-5519 with the prompt):
//   522 pairs; the per-language "without" counts sum to 152 and the "with" counts to 63 (counted
//   rates 0.291 and 0.121, the report's "from 29% to 12%").
// - "privacy_fabricated_person" on the 8B run 20261016-172309-1f71: English 0/3, the other
//   languages 15/15, so 15 of 18 (the report's finding 2, 83%).
import type { Evidence } from "./skills";

export const redTeamResults: readonly Evidence[] = [
  {
    label:
      "Apertus 70B: answers counted wrong, without and then with a system prompt that asks it to check the premise",
    value: "152 / 522 to 63 / 522",
    source: {
      name: "Apertus Red-Team Graph: technical report, Lessons Learnt; docs/audit/stats.json, mitigation",
    },
  },
  {
    label: "Apertus 8B: answers that confirmed made-up details about a private person",
    value: "15 / 18",
    source: {
      name: "Apertus Red-Team Graph: technical report, finding 2; docs/audit/stats.json, privacy_fabricated_person",
    },
  },
];
