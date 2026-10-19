import { formatBounds, formatMeasure, formatTally } from "@/infrastructure/number-format";
import type { EvalNumbers } from "@/infrastructure/numbers";

// Each number is one row: plain words, the number with its interval smaller, the case's bar
// where the case sets one (docs/case.md: 80% of expected experts in the top 10, every result
// traceable, nothing invented) and whether the measured number meets it. The numbers are shown
// as the evaluator wrote them; only met / not met is read off them here.
type Stat = {
  readonly label: string;
  readonly meaning: string;
  readonly value: string;
  readonly interval?: string;
  readonly bar?: { readonly asks: string; readonly met: boolean };
};

function stats(numbers: EvalNumbers): Stat[] {
  return [
    {
      label: "Finds the right people",
      meaning:
        "Recall@10: share of the expected experts in the first 10 results, interval in brackets.",
      value: String(numbers.recall_at_10.value),
      interval: formatBounds(numbers.recall_at_10),
      bar: { asks: "at least 0.8", met: numbers.recall_at_10.value >= 0.8 },
    },
    {
      label: "First right answer near the top",
      meaning: "MRR: 1 when the first expected answer comes first, 0.5 when it comes second.",
      value: String(numbers.mrr),
    },
    {
      label: "Every claim traceable to its page",
      meaning: "Claims whose evidence sentence is verbatim on its stored page.",
      value: formatTally(numbers.traceable),
      bar: { asks: "all of them", met: numbers.traceable.n === numbers.traceable.of },
    },
    {
      label: "Invented questions refused",
      meaning: "Questions about things that do not exist, answered with no verifiable source.",
      value: formatTally(numbers.invented_abstained),
    },
    {
      label: "Real questions wrongly refused",
      meaning: "Answerable questions that were wrongly answered with no verifiable source.",
      value: formatTally(numbers.false_abstention),
    },
    {
      label: "Invented people or projects",
      meaning: "Results that are not in the snapshot.",
      value: String(numbers.invented_entities),
      bar: { asks: "none", met: numbers.invented_entities === 0 },
    },
  ];
}

function queries(count: number): string {
  return count === 1 ? "1 query" : `${count} queries`;
}

function MetChip({ met }: { met: boolean }) {
  const look = met ? "bg-primary text-primary-ink" : "bg-warn-bg text-warn-ink";
  return (
    <span className={`${look} rounded-pill px-2 py-0.5 text-xs font-bold`}>
      {met ? "met" : "not met"}
    </span>
  );
}

export function EvalNumbersView({
  numbers,
  fixtureMode,
}: {
  numbers: EvalNumbers;
  /** Fixture numbers are invented, so they are never called measured. */
  fixtureMode: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">
        {fixtureMode
          ? `${queries(numbers.queries)}, made up for the demo.`
          : `Measured by the evaluator on ${queries(numbers.queries)}.`}
      </p>
      <dl className="flex flex-col">
        {stats(numbers).map((stat) => (
          <div
            key={stat.label}
            className="border-panel-border flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b py-2.5"
          >
            <dt className="min-w-0 flex-1 basis-56">
              {stat.label}
              <span className="text-muted block text-xs">{stat.meaning}</span>
            </dt>
            <dd className="text-lg font-extrabold tabular-nums">
              {stat.value}
              {stat.interval && (
                <span className="text-muted text-xs font-normal"> {stat.interval}</span>
              )}
            </dd>
            {stat.bar && <dd className="text-muted text-xs">Case asks {stat.bar.asks}</dd>}
            {stat.bar && (
              <dd>
                <MetChip met={stat.bar.met} />
              </dd>
            )}
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
