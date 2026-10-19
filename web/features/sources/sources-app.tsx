"use client";

import { useId } from "react";
import { AddSourceGuide } from "./add-source-guide";
import { SourceCards } from "./source-cards";
import { type SourcesApi, httpSourcesApi } from "./sources-api";
import { type SourcesState, useSources } from "./use-sources";

export type SourcesAppProps = {
  /** The engine serves invented fixtures (DEMO_FIXTURES); the list is labelled as such. */
  fixtureMode: boolean;
  /** Pass a stable object; a new one asks again. */
  api?: SourcesApi;
};

// The institutions the engine crawled, as /api/sources lists them, and how a new one is added.
// The guide is shown in every state, since it does not depend on the engine.
export function SourcesApp({ fixtureMode, api = httpSourcesApi }: SourcesAppProps) {
  const { state, retry } = useSources(api);
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${id}-list`} className="flex flex-col gap-3">
        <h3 id={`${id}-list`} className="text-lg font-extrabold">
          Institutions crawled
        </h3>
        <p>Each source is an institution whose public pages the engine crawls.</p>
        {fixtureMode && state.status === "ok" && (
          <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
            <span className="font-extrabold">FIXTURE</span> Invented sources and counts for the
            demo.
          </p>
        )}
        <div aria-live="polite" className="flex flex-col items-start gap-3">
          <StatusLine state={state} onRetry={retry} />
        </div>
        {state.status === "ok" && <SourceCards sources={state.list.sources} />}
      </section>
      <AddSourceGuide />
    </div>
  );
}

function StatusLine({ state, onRetry }: { state: SourcesState; onRetry: () => void }) {
  switch (state.status) {
    case "loading":
      return <p>Loading the sources.</p>;
    case "not_connected":
      return <p>The sources list is not connected yet.</p>;
    case "error":
      return (
        <>
          <p>The sources could not be loaded.</p>
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
      return (
        <p className="text-muted text-sm">
          Snapshot <span className="font-bold">{state.list.snapshot}</span>:{" "}
          {state.list.sources.length === 1 ? "1 source" : `${state.list.sources.length} sources`}.
        </p>
      );
  }
}
