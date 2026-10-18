import { checklistCriteria } from "./criteria";
import type { StoryController } from "./use-story";

export function CriteriaChecklist({ controller }: { controller: StoryController }) {
  const finished = new Set(controller.progress.finishedCriteria);
  return (
    <section
      aria-label="Case criteria"
      className="bg-panel shadow-panel border-panel-border flex w-[min(17rem,calc(100vw-2rem))] flex-col gap-2 rounded-3xl border p-4"
    >
      <h2 className="text-sm font-extrabold">The case, met in the game</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {checklistCriteria.map(({ criterion, label }) => {
          const met = finished.has(criterion);
          const coming = controller.progress.quests.some(
            (entry) => entry.quest.criterion === criterion && entry.status === "coming",
          );
          return (
            <li key={criterion} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                  met ? "bg-primary text-primary-ink" : "border-panel-border border-2"
                }`}
              >
                {met ? "✓" : ""}
              </span>
              <span className={met ? "font-bold" : "text-muted"}>
                {label}
                <span className="sr-only">{met ? ": met" : ": not yet"}</span>
                {coming && (
                  <span className="text-muted block text-xs font-normal">coming next</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
