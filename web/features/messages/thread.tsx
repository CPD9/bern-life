"use client";

import { type FormEvent, useId, useState } from "react";
import { BODY_MAX } from "./input";
import type { MessageView } from "./types";

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Thread({
  title,
  messages,
  hasOlder,
  onOlder,
  onSend,
  onDelete,
}: {
  title: string;
  messages: MessageView[];
  hasOlder: boolean;
  onOlder: () => void;
  onSend: (body: string) => Promise<boolean>;
  onDelete: (messageId: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onSend(draft)) setDraft("");
  }

  return (
    <section className="flex flex-col gap-3" aria-label={`Conversation with ${title}`}>
      <h2 className="text-xl font-extrabold">{title}</h2>
      {hasOlder && (
        <button
          type="button"
          onClick={onOlder}
          className="bg-chip rounded-pill self-center px-4 py-1 text-sm font-bold"
        >
          Show older messages
        </button>
      )}
      {messages.length === 0 ? (
        <p className="text-muted">No messages yet. Say hello.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-2 ${
                message.mine ? "bg-chip self-end" : "bg-panel border-panel-border self-start border"
              }`}
            >
              <span className="text-muted text-xs font-bold">
                {message.mine ? "You" : message.author.displayName} · {time(message.createdAt)}
              </span>
              <span className="break-words whitespace-pre-wrap">{message.body}</span>
              {message.mine && (
                <button
                  type="button"
                  onClick={() => onDelete(message.id)}
                  className="text-muted self-end text-xs underline"
                  aria-label={`Delete your message from ${time(message.createdAt)}`}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={`${id}-body`} className="sr-only">
          Message
        </label>
        <textarea
          id={`${id}-body`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={BODY_MAX}
          rows={2}
          placeholder="Write a message"
          className="bg-chip placeholder:text-muted min-w-0 flex-1 rounded-2xl px-4 py-2"
        />
        <button
          type="submit"
          className="bg-primary text-primary-ink rounded-pill self-end px-5 py-2 font-bold"
        >
          Send
        </button>
      </form>
    </section>
  );
}
