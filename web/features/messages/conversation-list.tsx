"use client";

import { type FormEvent, useId } from "react";
import type { Start } from "./input";
import type { ConversationSummary } from "./types";

const field = "bg-chip rounded-pill placeholder:text-muted w-full px-4 py-2";

export function conversationName(conversation: ConversationSummary): string {
  const names = conversation.others.map((person) => person.displayName).join(", ");
  if (conversation.kind === "group") return conversation.title ?? names;
  return names || "Just you";
}

function NewChatForm({ onStart }: { onStart: (start: Start) => void }) {
  const id = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const read = (name: string) => {
      const element = form.elements.namedItem(name);
      return element instanceof HTMLInputElement ? element.value.trim() : "";
    };
    const handles = read("handles")
      .split(/[\s,]+/)
      .map((h) => h.replace(/^@/, ""))
      .filter(Boolean);
    const title = read("title");
    if (handles.length === 0) return;
    onStart(
      handles.length === 1 && title === ""
        ? { kind: "direct", handle: handles[0] as string }
        : { kind: "group", title: title || handles.map((h) => `@${h}`).join(", "), handles },
    );
    form.reset();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Start a conversation">
      <label htmlFor={`${id}-handles`} className="text-sm font-bold">
        Handle, or several for a group
      </label>
      <input id={`${id}-handles`} name="handles" placeholder="bea, cem" className={field} />
      <label htmlFor={`${id}-title`} className="text-sm font-bold">
        Group name (optional)
      </label>
      <input
        id={`${id}-title`}
        name="title"
        maxLength={80}
        placeholder="Bern Life"
        className={field}
      />
      <button
        type="submit"
        className="bg-primary text-primary-ink rounded-pill px-4 py-2 font-bold"
      >
        Start
      </button>
    </form>
  );
}

export function ConversationList({
  conversations,
  openId,
  onOpen,
  onStart,
}: {
  conversations: ConversationSummary[];
  openId: string | null;
  onOpen: (id: string) => void;
  onStart: (start: Start) => void;
}) {
  return (
    <nav className="flex flex-col gap-4" aria-label="Conversations">
      <NewChatForm onStart={onStart} />
      {conversations.length === 0 ? (
        <p className="text-muted text-sm">
          No conversations yet. Start one with someone&apos;s handle.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                aria-current={conversation.id === openId ? "true" : undefined}
                onClick={() => onOpen(conversation.id)}
                className="aria-current:bg-chip flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{conversationName(conversation)}</span>
                  <span className="text-muted block truncate text-sm">
                    {conversation.last ? conversation.last.body : "No messages yet"}
                  </span>
                </span>
                {conversation.unread > 0 && (
                  <span
                    className="bg-primary text-primary-ink rounded-pill px-2 text-sm font-bold"
                    aria-label={`${conversation.unread} unread`}
                  >
                    {conversation.unread}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
