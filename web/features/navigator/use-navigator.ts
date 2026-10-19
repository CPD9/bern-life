"use client";

// One controller per Navigator. The phone's Ask app and the agent (round C) drive the same
// instance, so a search started by either shows up in the same input and result list.
import { useCallback, useRef, useState } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchRequest } from "@/infrastructure/engine-types";
import type { BriefInput, NavigatorApi, NavigatorFailure } from "./navigator-api";
import { answerEvents } from "./navigator-events";

export type NavigatorRequest =
  { kind: "search"; search: SearchRequest } | { kind: "brief"; brief: BriefInput };

export type NavigatorState =
  | { status: "idle" }
  | { status: "loading"; request: NavigatorRequest }
  | { status: "done"; request: NavigatorRequest; response: SearchResponse }
  | { status: "failed"; request: NavigatorRequest; failure: NavigatorFailure };

/** Which input shows: a question, or a project brief. Lumi's skills switch it too. */
export type InputMode = "search" | "brief";

export type NavigatorController = {
  readonly state: NavigatorState;
  readonly draft: string;
  setDraft(query: string): void;
  readonly inputMode: InputMode;
  setInputMode(mode: InputMode): void;
  search(request: SearchRequest): void;
  /** Shows an answer already in hand (Lumi's), without asking the engine or telling the story. */
  show(response: SearchResponse): void;
  submitBrief(input: BriefInput): void;
  retry(): void;
};

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
      const outcome =
        request.kind === "search"
          ? await api.search(request.search)
          : await api.brief(request.brief);
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
