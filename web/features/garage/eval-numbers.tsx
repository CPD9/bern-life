import { formatInterval, formatMeasure, formatTally } from "./format";
import type { EvalNumbers } from "./numbers";

type Stat = { readonly label: string; readonly value: string; readonly meaning: string };

function stats(numbers: EvalNumbers): Stat[] {
  return [
    {
      label: "Recall@10",
      value: formatInterval(numbers.recall_at_10),
      meaning: "Share of the expected answers found in the first 10 results, interval in brackets.",
    },
    {
      label: "MRR",
      value: String(numbers.mrr),
      meaning: "Mean reciprocal rank: 1 when the first expected answer comes first, 0.5 second.",
    },
    {
      label: "Traceable claims",
      value: formatTally(numbers.traceable),
      meaning: "Claims whose evidence sentence is verbatim on its stored page.",
    },
    {
      label: "Invented questions abstained",
      value: formatTally(numbers.invented_abstained),
      meaning: "Questions about things that do not exist, answered with no verifiable source.",
    },
    {
      label: "False abstentions",
      value: formatTally(numbers.false_abstention),
      meaning: "Answerable questions that were wrongly answered with no verifiable source.",
    },
    {
      label: "Invented entities",
      value: String(numbers.invented_entities),
      meaning: "Results that are not in the snapshot.",
    },
  ];
}

// One tile per number, each with the sentence that says what it counts.
export function EvalNumbersView({ numbers }: { numbers: EvalNumbers }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">Measured by the evaluator on {numbers.queries} queries.</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {stats(numbers).map((stat) => (
          <div key={stat.label} className="bg-chip flex flex-col gap-1 rounded-2xl p-4">
            <dt className="text-muted text-sm font-bold">{stat.label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{stat.value}</dd>
            <dd className="text-muted text-sm">{stat.meaning}</dd>
          </div>
        ))}
      </dl>
      {numbers.slices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="font-extrabold">Recall@10 by slice</h4>
          <dl className="flex flex-col gap-1">
            {numbers.slices.map((slice) => (
              <div key={slice.name} className="flex flex-wrap justify-between gap-x-4">
                <dt>{slice.name}</dt>
                <dd className="font-bold tabular-nums">{formatMeasure(slice.recall_at_10)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
