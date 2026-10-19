// An agent's skills are the tools the app already has, nothing more. Each id names the feature
// that "Try" opens, so the host decides where it goes and a skill cannot promise a missing tool.

export type SkillId = "navigator" | "brief" | "report" | "opportunities";

export type Skill = {
  readonly id: SkillId;
  readonly name: string;
  readonly sentence: string;
};

export const skills: readonly Skill[] = [
  {
    id: "navigator",
    name: "Search people and units",
    sentence:
      "Finds people, units and projects on public UniBE, ARTORG and Diabetes Center Berne pages, each with the sentence that backs it.",
  },
  {
    id: "brief",
    name: "Read a project brief",
    sentence:
      "Reads a brief you upload, lists the needs it found with the sentence each came from, and matches experts to them.",
  },
  {
    id: "report",
    name: "Make a match report",
    sentence:
      "Saves an answer as a report you keep in Reports, with every claim linked to its page.",
  },
  {
    id: "opportunities",
    name: "Find opportunities",
    sentence:
      "Finds funding calls, services and spaces on the same pages, with deadlines and funders quoted as written.",
  },
];
