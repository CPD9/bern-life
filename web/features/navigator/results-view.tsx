import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { aspectMatrix } from "./aspect-matrix";
import { BriefNeeds } from "./brief-needs";
import { ExpandedTerms } from "./expanded-terms";
import { abstainMessage, canRetry, failureMessage } from "./messages";
import { ModeNotice } from "./mode-notices";
import { ResultCard } from "./result-card";
import type { NavigatorState } from "./use-navigator";

type ResultsViewProps = {
  state: NavigatorState;
  onRetry: () => void;
  onShowOnMap?: ((response: SearchResponse) => void) | undefined;
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
      if (response.abstained) return abstainMessage(response.abstain_reason);
      const count = response.results.length;
      return count === 0 ? "Nothing matched." : `${count} ${count === 1 ? "result" : "results"}`;
    }
  }
}

function Answer({
  response,
  onRetry,
  onShowOnMap,
}: ResultsViewProps & { response: SearchResponse }) {
  const matrix = aspectMatrix(response);
  return (
    <>
      <ModeNotice mode={response.mode} />
      {response.abstained && response.abstain_reason === "engine_error" && (
        <RetryButton onRetry={onRetry} />
      )}
      <ExpandedTerms terms={response.expanded_terms} />
      {matrix && <BriefNeeds matrix={matrix} />}
      {onShowOnMap && response.results.length > 0 && (
        <button
          type="button"
          onClick={() => onShowOnMap(response)}
          className="bg-primary text-primary-ink rounded-pill self-start px-5 py-2 font-bold"
        >
          Show on map
        </button>
      )}
      <ol className="flex flex-col gap-4">
        {response.results.map((result) => (
          <li key={result.profile.id}>
            <ResultCard result={result} />
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
