// An agent's skills are the tools the app already has, nothing more. Each id tells the host which
// tool "Try" opens, so a skill cannot promise a missing one. A skill carries its evidence as rows
// of label, value and source, the shape of a skill in the Apertus red-team roster (agent_facts.py):
// measured rows are read from /api/numbers when the app opens, quoted rows are fixed text from a
// named file. A skill with no number behind it has no rows rather than an invented one.
import type { EvalNumbers } from "@/infrastructure/numbers";
import { redTeamResults } from "./red-team-results";

export type SkillId = "navigator" | "premise" | "brief" | "report" | "opportunities";

/** Where a row comes from: a name, and a link when the file can be opened. */
export type EvidenceSource = { readonly name: string; readonly href?: string };

export type Evidence = {
  readonly label: string;
  readonly value: string;
  readonly source: EvidenceSource;
};

/** An evaluator number a skill cites, by its key in GET /api/numbers. */
export type Measure = keyof Pick<
  EvalNumbers,
  "recall_at_10" | "traceable" | "invented_abstained" | "false_abstention"
>;

export type Skill = {
  readonly id: SkillId;
  readonly name: string;
  readonly sentence: string;
  readonly measured: readonly Measure[];
  readonly quoted: readonly Evidence[];
};

export const skills: readonly Skill[] = [
  {
    id: "navigator",
    name: "Search people and units",
    sentence:
      "Finds people, units and projects on public UniBE, ARTORG and Diabetes Center Berne pages, each with the sentence that backs it.",
    measured: ["recall_at_10", "traceable"],
    quoted: [],
  },
  {
    id: "premise",
    name: "Checks the premise",
    sentence:
      "Takes what a question assumes as a claim to check: a person named after a title must be among those found, a reply may not repeat a premise no claim holds, and with no source the answer says so.",
    measured: ["invented_abstained", "false_abstention"],
    quoted: redTeamResults,
  },
  {
    id: "brief",
    name: "Read a project brief",
    sentence:
      "Reads a brief you upload, lists the needs it found with the sentence each came from, and matches experts to them.",
    measured: [],
    quoted: [],
  },
  {
    id: "report",
    name: "Make a match report",
    sentence:
      "Saves an answer as a report you keep in Reports, with every claim linked to its page.",
    measured: [],
    quoted: [],
  },
  {
    id: "opportunities",
    name: "Find opportunities",
    sentence:
      "Finds funding calls, services and spaces on the same pages, with deadlines and funders quoted as written.",
    measured: [],
    quoted: [],
  },
];
