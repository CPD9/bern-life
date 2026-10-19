import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ConnectionsApi } from "@/features/connections/connections-api";
import type { ConnectionView } from "@/features/connections/types";
import type { AppEventName } from "@/infrastructure/app-events";
import { useMessageWith, useWorldConnections } from "./world-connections";

function asked(status: ConnectionView["status"], unread = false): ConnectionView {
  return {
    id: "r1",
    person: { handle: "bea", displayName: "Bea Example" },
    status,
    direction: "outgoing",
    note: null,
    createdAt: "2026-10-19T08:00:00.000Z",
    respondedAt: null,
    unread,
  };
}

const renderRoom = (ownerName: string) => `room of ${ownerName}`;

function fakeApi(signedIn: boolean, first = asked("pending")) {
  let requests = [first];
  const api: ConnectionsApi = {
    people: async () => ({ ok: true, value: [] }),
    requests: async () =>
      signedIn ? { ok: true, value: requests } : { ok: false, failure: "unauthenticated" },
    ask: async () => ({ ok: true, value: "r2" }),
    answer: async () => ({ ok: true, value: null }),
    office: async () => ({ ok: true, value: null }),
  };
  return { api, accept: () => (requests = [asked("accepted")]) };
}

describe("useWorldConnections", () => {
  test("a request found accepted after the first read completes connection_saved, once", async () => {
    const heard: AppEventName[] = [];
    const server = fakeApi(true);
    const { result } = renderHook(() =>
      useWorldConnections({
        signedIn: true,
        renderRoom,
        api: server.api,
        events: { emit: (name) => void heard.push(name) },
      }),
    );
    await act(async () => {});
    expect([heard, result.current.people]).toEqual([[], []]);
    server.accept();
    await act(async () => result.current.wiring.controller.refresh());
    await act(async () => result.current.wiring.controller.refresh());
    expect(heard).toEqual(["connection_saved"]);
    expect(result.current.people).toEqual([{ handle: "bea", displayName: "Bea Example" }]);
  });

  test("a request accepted while you were away completes connection_saved on the first read", async () => {
    const heard: AppEventName[] = [];
    const told = (unread: boolean) => {
      const { api } = fakeApi(true, asked("accepted", unread));
      const events = { emit: (name: AppEventName) => void heard.push(name) };
      return renderHook(() => useWorldConnections({ signedIn: true, renderRoom, api, events }));
    };
    told(false);
    await act(async () => {});
    expect(heard).toEqual([]);
    told(true);
    await act(async () => {});
    expect(heard).toEqual(["connection_saved"]);
  });

  test("signed out there are no people, and the host's room is what a visit shows", async () => {
    const { api } = fakeApi(false);
    const { result } = renderHook(() => useWorldConnections({ signedIn: false, renderRoom, api }));
    await act(async () => {});
    expect(result.current.people).toBeNull();
    expect(result.current.wiring.renderRoom).toBe(renderRoom);
  });
});

describe("useMessageWith", () => {
  test("each ask gets its own key, and Messages opening it clears the ask", () => {
    const { result } = renderHook(() => useMessageWith());
    act(() => result.current.ask("bea"));
    expect(result.current.messageWith).toEqual({ handle: "bea", key: 1 });
    act(() => result.current.started());
    expect(result.current.messageWith).toBeUndefined();
    act(() => result.current.ask("bea"));
    expect(result.current.messageWith).toEqual({ handle: "bea", key: 2 });
  });
});
