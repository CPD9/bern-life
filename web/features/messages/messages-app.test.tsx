import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { Start } from "./input";
import { type Connect, connectOver } from "./live-client";
import {
  FAILURE_TEXT,
  messagesApiOver,
  type MessagesApi,
  type MessagesOutcome,
} from "./messages-api";
import { MessagesApp, StandaloneMessages } from "./messages-app";
import type { ConversationSummary, MessageView, Notice } from "./types";
import { type Every, useMessages } from "./use-messages";
import { useUnreadCount } from "./use-unread-count";

const CHAT = "11111111-1111-4111-8111-111111111111";
const ADA = { handle: "ada", displayName: "Ada Example" };
const BEA = { handle: "bea", displayName: "Bea Example" };

function message(id: string, body: string, mine: boolean, minute: number): MessageView {
  return {
    id,
    author: mine ? BEA : ADA,
    body,
    createdAt: `2026-10-18T21:${String(minute).padStart(2, "0")}:00.000Z`,
    mine,
  };
}

/** An in-memory server: one direct chat between Bea (you) and Ada, newest message first. */
function fakeServer(signedIn = true) {
  const stored: MessageView[] = [
    message("m2", "<b>bold?</b>", false, 2),
    message("m1", "Hallo Ada", true, 1),
  ];
  const calls: string[] = [];
  const started: Start[] = [];
  let unread = 1;
  const signedOut = { ok: false, failure: "unauthenticated" } as const;
  const summary = (): ConversationSummary => ({
    id: CHAT,
    kind: "direct",
    title: null,
    others: [ADA],
    last: stored[0]
      ? { body: stored[0].body, at: stored[0].createdAt, author: stored[0].author }
      : null,
    unread,
  });
  const api: MessagesApi = {
    conversations: async () => (signedIn ? { ok: true, value: [summary()] } : signedOut),
    start: async (start) => {
      started.push(start);
      return start.kind === "direct" && start.handle === "nobody"
        ? { ok: false, failure: "unknown_handle" }
        : { ok: true, value: CHAT };
    },
    page: async () => {
      calls.push("page");
      return { ok: true, value: { messages: [...stored], next: null } };
    },
    post: async (_id, body) => {
      const posted = message(`m${stored.length + 1}`, body, true, 10 + stored.length);
      stored.unshift(posted);
      return { ok: true, value: posted };
    },
    remove: async (_id, messageId) => {
      stored.splice(
        stored.findIndex((m) => m.id === messageId),
        1,
      );
      return { ok: true, value: null };
    },
    markRead: async () => {
      calls.push("read");
      unread = 0;
      return { ok: true, value: null };
    },
    unread: async () => (signedIn ? { ok: true, value: unread } : signedOut),
  };
  const arrive = (body: string) => {
    stored.unshift(message(`m${stored.length + 1}`, body, false, 20 + stored.length));
    unread += 1;
  };
  return { api, calls, started, arrive };
}

function fakeLive() {
  let notify: (notice: Notice) => void = () => {};
  let down: () => void = () => {};
  const connect: Connect = (onNotice, onDown) => {
    notify = onNotice;
    down = onDown;
    return () => {};
  };
  const polls: number[] = [];
  let poll: () => void = () => {};
  const schedule = (run: () => void, ms: number) => {
    polls.push(ms);
    poll = run;
    return () => {};
  };
  return {
    connect,
    schedule,
    polls,
    notice: () => act(async () => notify({ conversationId: CHAT, messageId: "x", kind: "posted" })),
    drop: () => act(async () => down()),
    tick: () => act(async () => poll()),
  };
}

async function shown(api: MessagesApi, connect: Connect) {
  await act(async () => {
    render(<StandaloneMessages api={api} connect={connect} />);
  });
}

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function thread(): string[] {
  return within(screen.getByRole("region"))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

describe("MessagesApp", () => {
  test("signed out, it says so and links to the account page", async () => {
    await shown(fakeServer(false).api, fakeLive().connect);
    expect(screen.getByRole("status").textContent).toBe("Sign in to use Messages. Sign in or join");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/account");
  });

  test("a thread reads oldest first, marks read, and shows bodies as text", async () => {
    const server = fakeServer();
    await shown(server.api, fakeLive().connect);
    expect(screen.getByLabelText("1 unread")).toBeTruthy();
    await click(/Ada Example/);
    expect(thread().map((t) => t.split(" · ")[0])).toEqual(["You", "Ada Example"]);
    expect(thread()[1]).toContain("<b>bold?</b>");
    expect(document.querySelector("li b")).toBeNull();
    expect(server.calls).toEqual(["page", "read"]);
    expect(screen.queryByLabelText("1 unread")).toBeNull();
  });

  test("sending appends and clears; deleting removes your message", async () => {
    await shown(fakeServer().api, fakeLive().connect);
    await click(/Ada Example/);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "See you at the pitch" },
    });
    await click("Send");
    expect(thread().at(-1)).toContain("See you at the pitch");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
    const deletes = screen.getAllByRole("button", { name: /Delete your message/ });
    await act(async () => fireEvent.click(deletes[0] as HTMLElement));
    expect(thread().some((t) => t.includes("Hallo Ada"))).toBe(false);
  });

  test("a live notice brings the new message into the open thread", async () => {
    const server = fakeServer();
    const live = fakeLive();
    await shown(server.api, live.connect);
    await click(/Ada Example/);
    server.arrive("Are you in Liebefeld?");
    await live.notice();
    expect(thread().at(-1)).toContain("Are you in Liebefeld?");
  });

  test("when the stream drops it says so and refreshes every 10 seconds", async () => {
    const server = fakeServer();
    const live = fakeLive();
    await act(async () => {
      render(<StandaloneMessagesWithSchedule api={server.api} live={live} />);
    });
    await live.drop();
    expect(
      screen.getByText("Live updates are unavailable; refreshing every 10 seconds."),
    ).toBeTruthy();
    expect(live.polls).toEqual([10_000]);
    server.arrive("polled in");
    await live.tick();
    expect(screen.getByLabelText("2 unread")).toBeTruthy();
  });

  test("starting a chat by handle opens it; an unknown handle is a sentence", async () => {
    const server = fakeServer();
    await shown(server.api, fakeLive().connect);
    const start = async (handles: string) => {
      fireEvent.change(screen.getByLabelText("Handle, or several for a group"), {
        target: { value: handles },
      });
      await click("Start");
    };
    await start("@ada");
    expect(server.started).toEqual([{ kind: "direct", handle: "ada" }]);
    expect(screen.getByRole("region", { name: "Conversation with Ada Example" })).toBeTruthy();
    await start("nobody");
    expect(screen.getByRole("alert").textContent).toBe(FAILURE_TEXT.unknown_handle);
    await start("ada, cem");
    expect(server.started.at(-1)).toEqual({
      kind: "group",
      title: "@ada, @cem",
      handles: ["ada", "cem"],
    });
  });
});

function StandaloneMessagesWithSchedule({
  api,
  live,
}: {
  api: MessagesApi;
  live: ReturnType<typeof fakeLive>;
}) {
  return <UseMessagesHarness api={api} connect={live.connect} schedule={live.schedule} />;
}

function UseMessagesHarness({
  api,
  connect,
  schedule,
}: {
  api: MessagesApi;
  connect: Connect;
  schedule: Every;
}) {
  return <MessagesApp controller={useMessages(api, connect, schedule)} />;
}

function Badge({ api, connect }: { api: MessagesApi; connect: Connect }) {
  const unread = useUnreadCount(api, connect);
  return <p>{unread === null ? "no badge" : `${unread} unread`}</p>;
}

describe("useUnreadCount", () => {
  test("is null when signed out and follows live notices when signed in", async () => {
    await act(async () => {
      render(<Badge api={fakeServer(false).api} connect={fakeLive().connect} />);
    });
    expect(screen.getByText("no badge")).toBeTruthy();

    const server = fakeServer();
    const live = fakeLive();
    await act(async () => {
      render(<Badge api={server.api} connect={live.connect} />);
    });
    expect(screen.getByText("1 unread")).toBeTruthy();
    server.arrive("one more");
    await live.notice();
    expect(screen.getByText("2 unread")).toBeTruthy();
  });
});

describe("the live client and the HTTP client", () => {
  test("connectOver passes our notices on, ignores others, and closes when the stream fails", () => {
    let message: (data: string) => void = () => {};
    let error: () => void = () => {};
    let closed = 0;
    const notices: Notice[] = [];
    let downs = 0;
    connectOver(() => ({
      onMessage: (listener) => (message = listener),
      onError: (listener) => (error = listener),
      close: () => (closed += 1),
    }))(
      (notice) => notices.push(notice),
      () => (downs += 1),
    );
    const notice: Notice = { conversationId: CHAT, messageId: CHAT, kind: "deleted" };
    message(JSON.stringify(notice));
    message("not ours");
    error();
    expect([notices, closed, downs]).toEqual([[notice], 1, 1]);
  });

  test("messagesApiOver maps answers: the value, a refusal marker, or network", async () => {
    const answers: (Response | Error)[] = [
      Response.json({ message: message("m9", "hi", true, 9) }, { status: 201 }),
      Response.json({ error: "not_found" }, { status: 404 }),
      new Error("offline"),
    ];
    const paths: string[] = [];
    const api = messagesApiOver(async (path) => {
      paths.push(path);
      const next = answers.shift();
      if (next instanceof Error || next === undefined) throw next ?? new Error("done");
      return next;
    });
    const posted: MessagesOutcome<MessageView> = await api.post(CHAT, "hi");
    expect(posted.ok && posted.value.body).toBe("hi");
    expect(await api.page(CHAT, "abc")).toEqual({ ok: false, failure: "not_found" });
    expect(await api.unread()).toEqual({ ok: false, failure: "network" });
    expect(paths).toEqual([
      `/api/messages/conversations/${CHAT}/messages`,
      `/api/messages/conversations/${CHAT}/messages?before=abc`,
      "/api/messages/unread",
    ]);
  });
});
