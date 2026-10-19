"use client";

// Lumi's chat panel. A native modal dialog like the phone: the world behind it is inert and Escape
// closes it. Opening puts focus in the message box; closing gives focus back to whatever opened it.
// The conversation lives in this component's state while it stays mounted, and nowhere else.
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { maxQueryLength } from "@/infrastructure/search-request";
import type { AnswerMode } from "./agent-reply";
import { type LumiApi, httpLumiApi } from "./lumi-api";
import { TurnView } from "./lumi-turn";
import { ModeChip } from "./mode-chip";
import { suggestions } from "./suggestions";
import { type LumiActions, useLumiChat } from "./use-lumi-chat";

export type LumiChatProps = LumiActions & {
  open: boolean;
  onClose: () => void;
  /** The name the player gave their agent. */
  agentName?: string;
  /** The agent's bear, drawn small beside its name. */
  bear?: ReactNode;
  /** How the engine answers, from health, shown until Lumi's first reply says it for itself. */
  engineMode?: AnswerMode | null;
  api?: LumiApi;
};

export function LumiChat({
  open,
  onClose,
  agentName = "Lumi",
  bear,
  engineMode = null,
  api = httpLumiApi,
  ...actions
}: LumiChatProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const chat = useLumiChat(api, actions);
  const replyMode = chat.turns.findLast((turn) => turn.lumi.status === "replied")?.lumi;
  const mode = replyMode?.status === "replied" ? replyMode.reply.mode : engineMode;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      element.showModal();
      input.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const element = conversation.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chat.turns.length]);

  function handleClose() {
    onClose();
    opener.current?.focus();
  }

  function send(text: string) {
    if (chat.send(text)) setDraft("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send(draft);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={handleClose}
      className="bg-panel text-ink m-0 ml-auto h-dvh max-h-none w-screen max-w-none p-0 backdrop:bg-black/30 sm:w-[28rem]"
    >
      <div className="flex h-full flex-col">
        <header className="border-panel-border flex items-center gap-3 border-b px-4 py-3">
          {bear && (
            <div aria-hidden="true" className="size-12 shrink-0">
              {bear}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-lg font-extrabold">
              {agentName}
            </h2>
            <p className="text-muted text-sm">Your Navigator</p>
          </div>
          {mode && <ModeChip mode={mode} />}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="bg-chip rounded-pill px-4 py-1.5 text-sm font-bold"
          >
            Close
          </button>
        </header>

        <div
          ref={conversation}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4"
        >
          {chat.turns.length === 0 && (
            <div className="flex flex-col gap-3">
              <p>
                Ask about research and expertise in Bern. Every person I name comes with a card that
                shows the sentence and the page it is from.
              </p>
              <p className="text-muted text-sm">Try one of these:</p>
              <ul className="flex flex-col items-start gap-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.text}>
                    <button
                      type="button"
                      onClick={() => send(suggestion.text)}
                      className="bg-chip rounded-2xl px-4 py-2 text-left text-sm font-bold"
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ol
            aria-live="polite"
            aria-label={`Conversation with ${agentName}`}
            className="flex flex-col gap-6"
          >
            {chat.turns.map((turn, index) => (
              <TurnView
                key={turn.id}
                turn={turn}
                name={agentName}
                latest={index === chat.turns.length - 1}
                onRetry={chat.retry}
              />
            ))}
          </ol>
        </div>

        <form
          onSubmit={submit}
          className="border-panel-border flex items-end gap-2 border-t px-4 py-3"
        >
          <label htmlFor={inputId} className="sr-only">
            Message {agentName}
          </label>
          <textarea
            ref={input}
            id={inputId}
            rows={2}
            value={draft}
            maxLength={maxQueryLength}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder="Who works on glucose sensors in Bern?"
            className="bg-chip placeholder:text-muted min-w-0 flex-1 resize-none rounded-2xl px-4 py-3"
          />
          <button
            type="submit"
            disabled={chat.busy}
            className="bg-primary text-primary-ink rounded-pill px-5 py-3 font-bold disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </dialog>
  );
}
