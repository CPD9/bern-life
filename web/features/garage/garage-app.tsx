"use client";

import { type ReactNode, useId, useRef } from "react";
import { formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import type { Numbers } from "@/infrastructure/numbers";
import { type NumbersApi, httpNumbersApi } from "@/infrastructure/numbers-api";
import { type NumbersState, useNumbers } from "@/infrastructure/use-numbers";
import { EvalNumbersView } from "./eval-numbers";
import { ModelNumbersView } from "./model-numbers";
import { useOnce } from "./use-once";

export type GarageAppProps = {
  /** The engine serves invented fixtures (DEMO_FIXTURES); its numbers are labelled, never "seen". */
  fixtureMode: boolean;
  /** Once, when the garage first opens. */
  onVisited?: () => void;
  /** Once, when measured numbers from the engine (not a fixture) are on screen. */
  onNumbersSeen?: () => void;
  /** Pass a stable object; a new one asks again. */
  api?: NumbersApi;
  /** The agent's skills with their evidence, drawn by the host from the numbers loaded here. */
  renderSkills?: (numbers: NumbersState) => ReactNode;
};

// The Apertus models behind the Navigator and the numbers measured for this snapshot, shown
// exactly as /api/numbers gives them, then the agent's skills. Nothing here is estimated, compared
// or filled in, and nothing is added: models and skills are read-only.
export function GarageApp({
  fixtureMode,
  onVisited,
  onNumbersSeen,
  api = httpNumbersApi,
  renderSkills,
}: GarageAppProps) {
  const { state, retry } = useNumbers(api);
  const status = useRef<HTMLDivElement>(null);
  const id = useId();
  useOnce(true, onVisited);
  useOnce(!fixtureMode && state.status === "ok" && state.numbers.eval !== null, onNumbersSeen);

  return (
    <div className="flex flex-col gap-6">
      <p>The models behind the Navigator, and the numbers for this snapshot.</p>
      {fixtureMode && state.status === "ok" && (
        <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
          <span className="font-extrabold">Sample data.</span> Invented numbers for the demo, not
          from the evaluator or the search service.
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
      {renderSkills && (
        <section aria-labelledby={`${id}-skills`} className="flex flex-col gap-3">
          <h3 id={`${id}-skills`} className="text-lg font-extrabold">
            Skills
          </h3>
          <p className="text-muted text-sm">
            Each skill with the evidence behind it. Skills come with the app and models are set on
            the server, as endpoints in its settings; neither is added here.
          </p>
          {renderSkills(state)}
        </section>
      )}
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
