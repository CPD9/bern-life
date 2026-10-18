// Live updates without a broker: one Postgres LISTEN per server process, fanned out to the
// signed-in users who are members of the conversation a notice names. Notices carry ids only, so
// a client fetches the message itself through the membership-checked route.
import { db } from "@/infrastructure/db";
import { parseNotice } from "./notice";
import { CHANNEL, membersOf } from "./store";
import type { Notice } from "./types";

export const HEARTBEAT_MS = 25_000;

type Listen = (channel: string, onPayload: (payload: string) => void) => Promise<unknown>;
type Members = (conversationId: string) => Promise<string[]>;
type Subscriber = { userId: string; send: (notice: Notice) => void };

export class Hub {
  private readonly subscribers = new Set<Subscriber>();
  private listening: Promise<unknown> | null = null;

  constructor(
    private readonly listen: Listen,
    private readonly members: Members,
  ) {}

  /** Starts listening on first use; the returned function unsubscribes. */
  async subscribe(userId: string, send: (notice: Notice) => void): Promise<() => void> {
    this.listening ??= this.listen(CHANNEL, (payload) => void this.deliver(payload));
    await this.listening;
    const subscriber = { userId, send };
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private async deliver(payload: string): Promise<void> {
    const notice = parseNotice(payload);
    if (notice === null || this.subscribers.size === 0) return;
    const members = new Set(await this.members(notice.conversationId));
    for (const subscriber of this.subscribers) {
      if (members.has(subscriber.userId)) subscriber.send(notice);
    }
  }
}

let shared: Hub | undefined;

export function hub(): Hub {
  shared ??= new Hub(
    (channel, onPayload) => db().listen(channel, onPayload),
    (conversationId) => membersOf(db(), conversationId),
  );
  return shared;
}

/** Server-Sent Events for one signed-in user: an event per notice, a comment as heartbeat. */
export function eventStream(
  live: Hub,
  userId: string,
  signal: AbortSignal,
  heartbeatMs = HEARTBEAT_MS,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let stop = () => {};
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      const unsubscribe = await live.subscribe(userId, (notice) => {
        write(`event: message\ndata: ${JSON.stringify(notice)}\n\n`);
      });
      const heartbeat = setInterval(() => write(": ping\n\n"), heartbeatMs);
      stop = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      write(": connected\n\n");
      signal.addEventListener("abort", () => {
        stop();
        controller.close();
      });
    },
    cancel() {
      stop();
    },
  });
}
