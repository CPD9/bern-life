"use client";

import { useEffect, useRef } from "react";
import { ConversationList, conversationName } from "./conversation-list";
import type { Connect } from "./live-client";
import { FAILURE_TEXT, type MessagesApi } from "./messages-api";
import { Thread } from "./thread";
import { type MessagesController, useMessages } from "./use-messages";

/** The Messages app. W1 mounts it in the phone with `api` and `connect`; the same props serve the
 *  standalone /messages page. Bodies render as text, never as HTML. The two columns follow the
 *  app's own width, not the window's, so the 400 px phone keeps one column on a laptop. */
export function MessagesApp({ controller }: { controller: MessagesController }) {
  if (controller.status === "loading") {
    return (
      <p role="status" className="text-muted">
        Loading your conversations…
      </p>
    );
  }
  if (controller.status === "signed-out") {
    return (
      <p role="status">
        Sign in to use Messages.{" "}
        <a href="/account" className="font-bold underline">
          Sign in or join
        </a>
      </p>
    );
  }
  const open = controller.conversations.find((c) => c.id === controller.openId);
  return (
    <div className="@container flex flex-col gap-4">
      <p className="text-muted text-sm" role="status">
        {controller.updates === "live"
          ? "Live"
          : "Live updates are unavailable; refreshing every 10 seconds."}
      </p>
      <div className="grid gap-6 @xl:grid-cols-[minmax(0,15rem)_1fr]">
        <ConversationList
          conversations={controller.conversations}
          openId={controller.openId}
          onOpen={(id) => void controller.open(id)}
          onStart={(start) => void controller.start(start)}
        />
        {open === undefined ? (
          <p className="text-muted">Pick a conversation, or start one.</p>
        ) : (
          <Thread
            title={conversationName(open)}
            messages={controller.thread}
            hasOlder={controller.hasOlder}
            onOlder={() => void controller.loadOlder()}
            onSend={controller.send}
            onDelete={(messageId) => void controller.remove(messageId)}
          />
        )}
      </div>
      {controller.failure !== null && (
        <p role="alert" className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3">
          {FAILURE_TEXT[controller.failure]}
        </p>
      )}
    </div>
  );
}

/** A request to open the direct thread with a handle; a new `key` asks again for the same one. */
export type StartWith = { readonly handle: string; readonly key: number };

/** Opens (or starts) the direct thread with `startWith.handle` once the list is ready, once per
 *  key, as "Message" on a member does; `onStarted` lets the host forget the request. */
function useStartWith(
  controller: MessagesController,
  startWith: StartWith | undefined,
  onStarted: (() => void) | undefined,
) {
  const handled = useRef<number | null>(null);
  const latest = useRef({ controller, onStarted });
  useEffect(() => {
    latest.current = { controller, onStarted };
  });
  const ready = controller.status === "ready";
  useEffect(() => {
    if (!ready || startWith === undefined || handled.current === startWith.key) return;
    handled.current = startWith.key;
    void latest.current.controller.start({ kind: "direct", handle: startWith.handle });
    latest.current.onStarted?.();
  }, [ready, startWith]);
}

export function StandaloneMessages({
  api,
  connect,
  startWith,
  onStarted,
}: {
  api: MessagesApi;
  connect: Connect;
  startWith?: StartWith | undefined;
  onStarted?: (() => void) | undefined;
}) {
  const controller = useMessages(api, connect);
  useStartWith(controller, startWith, onStarted);
  return <MessagesApp controller={controller} />;
}
