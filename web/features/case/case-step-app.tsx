"use client";

import { useRef } from "react";
import type { EvalNumbers } from "@/infrastructure/numbers";
import { type NumbersApi, httpNumbersApi } from "@/infrastructure/numbers-api";
import { Button } from "@/infrastructure/ui/button";
import { type NumbersState, useNumbers } from "@/infrastructure/use-numbers";
import { type StepReading, stepReading } from "./case-numbers";
import { type CaseStep, caseStepAppId, caseSteps, stepAfter, stepBefore } from "./case-steps";

export type CaseStepAppProps = {
  step: CaseStep;
  /** The engine serves invented fixtures (DEMO_FIXTURES): its numbers are labelled, never a verdict. */
  fixtureMode: boolean;
  /** Runs the step's question in Ask and opens it. */
  onAsk: (query: string) => void;
  /** Opens another app on the phone: the next or previous step, or Sources. */
  onOpenApp: (appId: string) => void;
  /** Pass a stable object; a new one asks again. */
  api?: NumbersApi;
};

// One step of the case: what it asks, one Try it, what to look for, the number the evaluator
// measured for it, then Next and Back. The screen reads on its own, so a jury member who never saw
// the app can walk the case tile by tile.
export function CaseStepApp({
  step,
  fixtureMode,
  onAsk,
  onOpenApp,
  api = httpNumbersApi,
}: CaseStepAppProps) {
  const { state, retry } = useNumbers(api);
  const next = stepAfter(step);
  const back = stepBefore(step);
  const { action } = step;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <p className="text-muted text-sm font-bold">
        Step {step.number} of {caseSteps.length}
      </p>
      <section aria-label="The case asks" className="flex flex-col gap-1">
        <h3 className="text-muted text-sm font-bold">The case asks</h3>
        <p className="text-lg font-bold">{step.asks}</p>
      </section>
      <Button
        variant="primary"
        className="py-3 text-lg"
        onClick={() => (action.kind === "ask" ? onAsk(action.query) : onOpenApp(action.appId))}
      >
        Try it
      </Button>
      {action.kind === "ask" && action.then.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted text-sm font-bold">Then try</span>
          {action.then.map((query) => (
            <Button key={query} onClick={() => onAsk(query)}>
              {query}
            </Button>
          ))}
        </div>
      )}
      <section aria-label="What to look for" className="flex flex-col gap-1">
        <h3 className="text-muted text-sm font-bold">What to look for</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {step.lookFor.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section aria-label="Measured" className="flex flex-col gap-2">
        <h3 className="text-muted text-sm font-bold">Measured</h3>
        <Measured step={step} state={state} fixtureMode={fixtureMode} onRetry={retry} />
      </section>
      <nav aria-label="Steps" className="mt-auto flex items-center justify-between gap-2 pt-2">
        {back ? <Button onClick={() => onOpenApp(caseStepAppId(back))}>Back</Button> : <span />}
        {next && <Button onClick={() => onOpenApp(caseStepAppId(next))}>Next: {next.label}</Button>}
      </nav>
    </div>
  );
}

function Measured({
  step,
  state,
  fixtureMode,
  onRetry,
}: {
  step: CaseStep;
  state: NumbersState;
  fixtureMode: boolean;
  onRetry: () => void;
}) {
  const status = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* Try again unmounts its own button, so focus moves here instead of falling to the page. */}
      <div
        ref={status}
        tabIndex={-1}
        aria-live="polite"
        className="flex flex-col items-start gap-3"
      >
        <StatusLine
          state={state}
          onRetry={() => {
            status.current?.focus();
            onRetry();
          }}
        />
      </div>
      {state.status === "ok" && state.numbers.eval && (
        <Reading
          reading={stepReading(step.criterion, state.numbers.eval)}
          numbers={state.numbers.eval}
          snapshot={state.numbers.snapshot}
          fixtureMode={fixtureMode}
        />
      )}
    </>
  );
}

function StatusLine({ state, onRetry }: { state: NumbersState; onRetry: () => void }) {
  switch (state.status) {
    case "loading":
      return <p>Loading the numbers.</p>;
    case "not_connected":
      return <p>The numbers are not connected yet.</p>;
    case "error":
      return (
        <>
          <p>The numbers could not be loaded.</p>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </>
      );
    case "ok":
      return state.numbers.eval ? null : <p>The evaluator has not run on this snapshot.</p>;
  }
}

function queries(count: number): string {
  return count === 1 ? "1 query" : `${count} queries`;
}

function Reading({
  reading,
  numbers,
  snapshot,
  fixtureMode,
}: {
  reading: StepReading | null;
  numbers: EvalNumbers;
  snapshot: string;
  fixtureMode: boolean;
}) {
  if (reading === null || reading.rows.length === 0) {
    return <p>The evaluator measures no number for this step.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {fixtureMode ? (
        <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
          <span className="font-extrabold">FIXTURE</span> Invented numbers for the demo, not from
          the evaluator.
        </p>
      ) : (
        <p className="text-muted text-sm">
          Measured by the evaluator on {queries(numbers.queries)}, snapshot {snapshot}.
        </p>
      )}
      <dl className="flex flex-col gap-2">
        {reading.rows.map((row) => (
          <div key={row.label} className="bg-chip flex flex-col gap-1 rounded-2xl p-4">
            <dt className="text-muted text-sm font-bold">{row.label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {reading.verdict && !fixtureMode && (
        <p>
          <span className="font-extrabold">{reading.verdict.met ? "Met" : "Not met"}</span>: the
          case asks for {reading.verdict.bar}.
        </p>
      )}
    </div>
  );
}
