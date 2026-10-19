"use client";

// One controller per Navigator. The phone's Ask app and the agent (round C) drive the same
// instance, so a search started by either shows up in the same input and result list.
import { useCallback, useRef, useState } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchRequest } from "@/infrastructure/engine-types";
import type { BriefInput, NavigatorApi, NavigatorFailure, NavigatorOutcome } from "./navigator-api";
import { answerEvents } from "./navigator-events";

export type NavigatorRequest =
  { kind: "search"; search: SearchRequest } | { kind: "brief"; brief: BriefInput };

export type NavigatorState =
  | { status: "idle" }
  | { status: "loading"; request: NavigatorRequest }
  | { status: "done"; request: NavigatorRequest; response: SearchResponse }
  | { status: "failed"; request: NavigatorRequest; failure: NavigatorFailure };

/** Which input shows: a question, or a project brief. Bärnli's skills switch it too. */
export type InputMode = "search" | "brief";

export type NavigatorController = {
  readonly state: NavigatorState;
  readonly draft: string;
  setDraft(query: string): void;
  readonly inputMode: InputMode;
  setInputMode(mode: InputMode): void;
  search(request: SearchRequest): void;
  /**
   * Shows an answer already in hand (Bärnli's), without asking the engine or telling the story. It is
   * a question's answer, so the question box shows, holding the question it answers.
   */
  show(response: SearchResponse): void;
  submitBrief(input: BriefInput): void;
  retry(): void;
};

// A brief the engine read no need from ran no search: its answer says why in `brief_unread` and
// nothing about the pages, so it is a failure with that reason, not an abstention or a story event.
function settled(outcome: NavigatorOutcome): NavigatorOutcome {
  if (!outcome.ok || outcome.response.brief_unread === undefined) return outcome;
  return { ok: false, failure: { kind: "unread", reason: outcome.response.brief_unread } };
}

export function useNavigator(
  api: NavigatorApi,
  events: AppEventSink = appEvents,
): NavigatorController {
  const [state, setState] = useState<NavigatorState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("search");
  const latest = useRef(0);

  const run = useCallback(
    async (request: NavigatorRequest) => {
      const id = ++latest.current;
      setState({ status: "loading", request });
      const outcome = settled(
        request.kind === "search"
          ? await api.search(request.search)
          : await api.brief(request.brief),
      );
      if (id !== latest.current) return;
      if (!outcome.ok) {
        setState({ status: "failed", request, failure: outcome.failure });
        return;
      }
      setState({ status: "done", request, response: outcome.response });
      for (const event of answerEvents(request, outcome.response)) events.emit(event);
    },
    [api, events],
  );

  return {
    state,
    draft,
    setDraft,
    inputMode,
    setInputMode,
    search: (request) => {
      setDraft(request.query);
      void run({ kind: "search", search: request });
    },
    show: (response) => {
      latest.current += 1;
      setInputMode("search");
      setDraft(response.query);
      setState({
        status: "done",
        request: { kind: "search", search: { query: response.query } },
        response,
      });
    },
    submitBrief: (brief) => void run({ kind: "brief", brief }),
    retry: () => {
      if (state.status !== "idle") void run(state.request);
    },
  };
}
