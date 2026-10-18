// Paper has no hover, so the meaning of every number is printed with the report
// (docs/match-report-design.md, "Hover doesn't exist on paper").
export const legendRules = [
  "The order is the search's order. The numbers describe each result; they never rank it.",
  "A dash (—) means a number could not be computed. It is not zero and not a bad score.",
  "Relevance is the share of your topics found in the result's verified claims. Filled chips were found; struck-through chips were not.",
  "Evidence is how directly the public page ties the name to the topic: in one passage, on the same page, or only on another page.",
  "Completeness counts the five profile fields the public pages fill. It describes the pages, not the expert.",
] as const;

export function ReportLegend() {
  return (
    <section className="flex break-inside-avoid flex-col gap-2 text-sm">
      <h2 className="font-extrabold">How to read this report</h2>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        {legendRules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <p className="text-muted">
        Confidence is not yet calibrated against hand-checked answers, so it is not shown as a
        number. Every quote is word for word from the public page linked beside it.
      </p>
    </section>
  );
}
