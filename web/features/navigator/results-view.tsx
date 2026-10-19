import { type ReactNode, useState } from "react";
import type { SearchResult } from "@/infrastructure/claims";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { aspectMatrix } from "./aspect-matrix";
import { BriefNeeds } from "./brief-needs";
import { ExpandedTerms } from "./expanded-terms";
import { abstainMessage, canRetry, failureMessage } from "./messages";
import { ModeNotice } from "./mode-notices";
import { ResultCard } from "@/infrastructure/ui/result-card";
import type { NavigatorState } from "./use-navigator";

type ResultsViewProps = {
  state: NavigatorState;
  fixtureMode: boolean;
  onRetry: () => void;
  onShowOnMap?: ((response: SearchResponse) => void) | undefined;
  onMakeReport?: ((response: SearchResponse) => boolean) | undefined;
  /** A control under each card, such as the Library's save button. */
  renderSave?: ((result: SearchResult) => ReactNode) | undefined;
};

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="bg-chip-selected text-chip-selected-ink rounded-pill self-start px-5 py-2 font-bold"
    >
      Try again
    </button>
  );
}

function MakeReportButton({
  response,
  onMakeReport,
}: {
  response: SearchResponse;
  onMakeReport: (response: SearchResponse) => boolean;
}) {
  const [blocked, setBlocked] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setBlocked(!onMakeReport(response))}
        className="bg-chip-selected text-chip-selected-ink rounded-pill px-5 py-2 font-bold"
      >
        Make a report
      </button>
      {blocked && (
        <p role="alert" className="text-sm">
          This browser blocks storage, so the report could not be kept.
        </p>
      )}
    </>
  );
}

function statusLine(state: NavigatorState): string {
  switch (state.status) {
    case "idle":
      return "";
    case "loading":
      return state.request.kind === "brief" ? "Reading your brief…" : "Searching public pages…";
    case "failed":
      return failureMessage(state.failure);
    case "done": {
      const { response } = state;
      if (response.abstained) return abstainMessage(response);
      const count = response.results.length;
      return count === 0 ? "Nothing matched." : `${count} ${count === 1 ? "result" : "results"}`;
    }
  }
}

function Answer({
  response,
  fixtureMode,
  onRetry,
  onShowOnMap,
  onMakeReport,
  renderSave,
}: ResultsViewProps & { response: SearchResponse }) {
  const matrix = aspectMatrix(response);
  return (
    <>
      <ModeNotice mode={response.mode} fixtureMode={fixtureMode} />
      {response.abstained && response.abstain_reason === "engine_error" && (
        <RetryButton onRetry={onRetry} />
      )}
      <ExpandedTerms terms={response.expanded_terms} />
      {matrix && <BriefNeeds matrix={matrix} />}
      {response.results.length > 0 && (onShowOnMap || onMakeReport) && (
        <div className="flex flex-wrap items-center gap-2">
          {onShowOnMap && (
            <button
              type="button"
              onClick={() => onShowOnMap(response)}
              className="bg-primary text-primary-ink rounded-pill px-5 py-2 font-bold"
            >
              Show on map
            </button>
          )}
          {onMakeReport && <MakeReportButton response={response} onMakeReport={onMakeReport} />}
        </div>
      )}
      <ol className="flex flex-col gap-4">
        {response.results.map((result) => (
          <li key={result.profile.id} className="flex flex-col gap-2">
            <ResultCard result={result} />
            {renderSave && <div className="self-start">{renderSave(result)}</div>}
          </li>
        ))}
      </ol>
    </>
  );
}

export function ResultsView(props: ResultsViewProps) {
  const { state, onRetry } = props;
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className={state.status === "done" ? "font-bold" : "text-muted"}>
        {statusLine(state)}
      </p>
      {state.status === "failed" && canRetry(state.failure) && <RetryButton onRetry={onRetry} />}
      {state.status === "done" && <Answer {...props} response={state.response} />}
    </div>
  );
}
