"use client";

import { useId, useRef } from "react";
import { formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import { EvalNumbersView } from "./eval-numbers";
import { ModelNumbersView } from "./model-numbers";
import type { Numbers } from "./numbers";
import { type GarageApi, httpGarageApi } from "./numbers-api";
import { type NumbersState, useNumbers, useOnce } from "./use-numbers";

export type GarageAppProps = {
  /** The engine serves invented fixtures (DEMO_FIXTURES); its numbers are labelled, never "seen". */
  fixtureMode: boolean;
  /** Once, when the garage first opens. */
  onVisited?: () => void;
  /** Once, when measured numbers from the engine (not a fixture) are on screen. */
  onNumbersSeen?: () => void;
  /** Pass a stable object; a new one asks again. */
  api?: GarageApi;
};

// The Apertus models behind the Navigator and the numbers measured for this snapshot, shown
// exactly as /api/numbers gives them. Nothing here is estimated, compared or filled in.
export function GarageApp({
  fixtureMode,
  onVisited,
  onNumbersSeen,
  api = httpGarageApi,
}: GarageAppProps) {
  const { state, retry } = useNumbers(api);
  const status = useRef<HTMLDivElement>(null);
  useOnce(true, onVisited);
  useOnce(!fixtureMode && state.status === "ok" && state.numbers.eval !== null, onNumbersSeen);

  return (
    <div className="flex flex-col gap-6">
      <p>The models behind the Navigator, and the numbers for this snapshot.</p>
      {fixtureMode && state.status === "ok" && (
        <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
          <span className="font-extrabold">FIXTURE</span> Invented numbers for the demo, not from
          the evaluator or the engine.
        </p>
      )}
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
            retry();
          }}
        />
      </div>
      {state.status === "ok" && <NumbersView numbers={state.numbers} fixtureMode={fixtureMode} />}
    </div>
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
          <button
            type="button"
            onClick={onRetry}
            className="bg-primary text-primary-ink rounded-pill px-5 py-2 font-bold"
          >
            Try again
          </button>
        </>
      );
    case "ok":
      return <Generated numbers={state.numbers} />;
  }
}

function Generated({ numbers }: { numbers: Numbers }) {
  const generated = new Date(numbers.generated_at);
  return (
    <p className="text-muted text-sm">
      Snapshot <span className="font-bold">{numbers.snapshot}</span>, numbers generated{" "}
      <time dateTime={numbers.generated_at}>
        {formatBernShortDate(generated)} {formatBernTime(generated)}
      </time>{" "}
      Bern time.
    </p>
  );
}

function NumbersView({ numbers, fixtureMode }: { numbers: Numbers; fixtureMode: boolean }) {
  const id = useId();
  return (
    <>
      <section aria-labelledby={`${id}-eval`} className="flex flex-col gap-3">
        <h3 id={`${id}-eval`} className="text-lg font-extrabold">
          Search quality
        </h3>
        {numbers.eval ? (
          <EvalNumbersView numbers={numbers.eval} fixtureMode={fixtureMode} />
        ) : (
          <p>The evaluator has not run on this snapshot.</p>
        )}
      </section>
      <section aria-labelledby={`${id}-models`} className="flex flex-col gap-3">
        <h3 id={`${id}-models`} className="text-lg font-extrabold">
          Models
        </h3>
        <ModelNumbersView models={numbers.models} />
      </section>
    </>
  );
}
