"use client";

// One exchange: what the player wrote, Lumi's reply or the plain sentence for why there is none,
// and, when Lumi could not answer, the plain search answer, labelled so it is never taken for
// Lumi's own.
import { useId } from "react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { AgentAction } from "./agent-reply";
import { type SearchState, type Turn, isAnswered, isBusy } from "./conversation";
import { LumiReply, ResultCards } from "./lumi-reply";
import { lumiFailureMessage, searchFailureMessage, searchSummary } from "./lumi-text";
import { ModeChip } from "./mode-chip";

function PlainAnswer({
  response,
  fixtureMode,
}: {
  response: SearchResponse;
  fixtureMode: boolean;
}) {
  const baseId = useId();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold">{searchSummary(response)}</p>
        <ModeChip source="answer" mode={response.mode} fixtureMode={fixtureMode} />
      </div>
      {response.results.length > 0 && (
        <ResultCards cards={response.results} cardId={(index) => `${baseId}-card-${index}`} />
      )}
    </>
  );
}

type PlainSearchProps = { state: SearchState; name: string; fixtureMode: boolean };

function PlainSearch({ state, name, fixtureMode }: PlainSearchProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="border-panel-border flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h3 id={headingId} className="font-extrabold">
        Plain search answer, not {name}&apos;s
      </h3>
      <p className="text-muted text-sm">
        {name} could not answer this, so here is what a search of the stored public pages found for
        the same words.
      </p>
      {state.status === "waiting" && <p className="text-muted">Searching public pages…</p>}
      {state.status === "failed" && <p>{searchFailureMessage(state.failure)}</p>}
      {state.status === "done" && (
        <PlainAnswer response={state.response} fixtureMode={fixtureMode} />
      )}
    </section>
  );
}

type TurnViewProps = {
  turn: Turn;
  name: string;
  fixtureMode: boolean;
  latest: boolean;
  onRetry: () => void;
  onRunHeld: (turnId: number, action: AgentAction) => void;
};

export function TurnView(props: TurnViewProps) {
  const { turn, name, fixtureMode, latest, onRetry, onRunHeld } = props;
  const { lumi, search } = turn;
  return (
    <li className="flex flex-col gap-3">
      <p className="bg-primary text-primary-ink max-w-[85%] self-end rounded-2xl rounded-tr-sm px-4 py-3 break-words whitespace-pre-wrap">
        <span className="sr-only">You: </span>
        {turn.text}
      </p>
      {lumi.status === "waiting" && <p className="text-muted">{name} is answering…</p>}
      {lumi.status === "failed" && <p>{lumiFailureMessage(lumi.failure, name)}</p>}
      {lumi.status === "replied" && (
        <LumiReply
          reply={lumi.reply}
          name={name}
          held={lumi.held}
          onRunHeld={(action) => onRunHeld(turn.id, action)}
        />
      )}
      {search && <PlainSearch state={search} name={name} fixtureMode={fixtureMode} />}
      {latest && !isAnswered(turn) && !isBusy(turn) && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-chip-selected text-chip-selected-ink rounded-pill self-start px-5 py-2 font-bold"
        >
          Try again
        </button>
      )}
    </li>
  );
}
