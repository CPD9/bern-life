import { ComingNext } from "@/infrastructure/ui/coming-next";

export type SkillId = "search" | "brief" | "report";

type Skill = { readonly id: SkillId; readonly title: string; readonly text: string };

// Each skill is a tool that exists today; "Try" opens it rather than describing it.
export const lumiSkills: readonly Skill[] = [
  {
    id: "search",
    title: "Search Bern experts",
    text: "Ask in your words, in German, English or French. Every result carries the sentence on a public page that proves it.",
  },
  {
    id: "brief",
    title: "Read a project brief",
    text: "Bring a PDF or paste the text. Lumi lists the needs she read, each with the sentence it came from, and shows which needs the experts cover.",
  },
  {
    id: "report",
    title: "Make a match report",
    text: "Keep an answer as a report with every claim and its source, ready to save as a PDF.",
  },
];

export const loopsText =
  "Loops: saved searches that run again when a new snapshot of the public pages arrives. New results come to you as notifications, each with its source.";

export function AgentsApp({ onTry }: { onTry: (skill: SkillId) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="lumi-title" className="flex flex-col gap-1">
        <h3 id="lumi-title" className="text-xl font-extrabold">
          Lumi
        </h3>
        <p className="text-muted">
          Your guide in Bern. She works only with these tools, and what she shows you comes with its
          source.
        </p>
      </section>
      <ul className="flex flex-col gap-3">
        {lumiSkills.map((skill) => (
          <li key={skill.id} className="bg-chip flex items-start gap-3 rounded-2xl p-4">
            <div className="flex flex-1 flex-col gap-1">
              <h4 className="font-extrabold">{skill.title}</h4>
              <p className="text-sm">{skill.text}</p>
            </div>
            <button
              type="button"
              aria-label={`Try: ${skill.title}`}
              onClick={() => onTry(skill.id)}
              className="bg-primary text-primary-ink rounded-pill shrink-0 px-4 py-1.5 font-bold"
            >
              Try
            </button>
          </li>
        ))}
      </ul>
      <ComingNext text={loopsText} />
    </div>
  );
}
