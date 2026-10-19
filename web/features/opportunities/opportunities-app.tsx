"use client";

import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import type { AppEventSink } from "@/infrastructure/app-events";
import type { SearchResult } from "@/infrastructure/claims";
import { ModeNotice } from "./mode-notice";
import { type OpportunitiesApi, httpOpportunitiesApi } from "./opportunities-api";
import { OpportunityCard } from "./opportunity-card";
import {
  maxOpportunityQueryLength,
  opportunityResults,
  starterQueries,
} from "./opportunity-request";
import { statusLine, retryable } from "./status";
import { useOpportunities } from "./use-opportunities";

export type OpportunitiesAppProps = {
  fixtureMode: boolean;
  /** The save control under each card, such as the Library's save button. */
  renderSave?: (result: SearchResult) => ReactNode;
  api?: OpportunitiesApi;
  events?: AppEventSink;
};

const browserApi = httpOpportunitiesApi((input, init) => fetch(input, init));

/** Funding calls, services and spaces from the public pages, each with the sentences it rests on. */
export function OpportunitiesApp({
  fixtureMode,
  renderSave,
  api = browserApi,
  events,
}: OpportunitiesAppProps) {
  const controller = useOpportunities(api);
  const [query, setQuery] = useState("");
  const id = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const { state } = controller;

  function retry() {
    // The button goes away while the search runs, so focus waits on the status line.
    statusRef.current?.focus();
    controller.retry();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    controller.search(query);
  }

  function start(starter: string) {
    setQuery(starter);
    controller.search(starter);
  }

  const results = state.status === "done" ? opportunityResults(state.response) : [];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted text-sm">
        Funding calls, services and spaces, found on public pages. Amounts and deadlines are shown
        only in the sentence the page states them in.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={`${id}-query`} className="font-bold">
          What are you looking for?
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${id}-query`}
            value={query}
            maxLength={maxOpportunityQueryLength}
            onChange={(event) => setQuery(event.target.value)}
            className="border-panel-border bg-panel min-w-0 flex-1 rounded-2xl border px-4 py-2"
          />
          <button
            type="submit"
            className="bg-chip-selected text-chip-selected-ink rounded-pill px-5 py-2 font-bold"
          >
            Search
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-2">
        <p className="text-muted text-sm">Or start from one of these:</p>
        <ul className="flex flex-wrap gap-2">
          {starterQueries.map((starter) => (
            <li key={starter}>
              <button
                type="button"
                onClick={() => start(starter)}
                className="bg-chip hover:bg-mark rounded-pill px-3 py-1 text-left text-sm"
              >
                {starter}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {fixtureMode && <p className="text-muted text-xs font-bold tracking-wide">FIXTURE data</p>}
      <p ref={statusRef} role="status" tabIndex={-1} className="font-bold">
        {statusLine(state, results.length)}
      </p>
      {state.status === "failed" && retryable(state.failure) && (
        <button
          type="button"
          onClick={retry}
          className="bg-chip-selected text-chip-selected-ink rounded-pill self-start px-5 py-2 font-bold"
        >
          Try again
        </button>
      )}
      {state.status === "done" && (
        <>
          <ModeNotice mode={state.response.mode} fixtureMode={fixtureMode} />
          {results.length > 0 && (
            <ul aria-label="Opportunities" className="flex flex-col gap-4">
              {results.map((result) => (
                <li key={result.profile.id}>
                  <OpportunityCard result={result} renderSave={renderSave} events={events} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
