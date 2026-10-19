import { describe, expect, mock, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import type { Connect } from "@/features/messages/live-client";
import { type MessagesApi, httpMessagesApi } from "@/features/messages/messages-api";
import { useUnreadMessages } from "./use-unread-messages";

function fakes(count: number) {
  const unread = mock(async () => ({ ok: true as const, value: count }));
  const api: MessagesApi = { ...httpMessagesApi, unread };
  const connect = mock<Connect>(() => () => undefined);
  return { api, unread, connect };
}

describe("useUnreadMessages", () => {
  test("signed out it fetches nothing, opens no stream and shows nothing", async () => {
    const { api, unread, connect } = fakes(3);
    const { result } = renderHook(() => useUnreadMessages(false, false, api, connect));
    await Promise.resolve();
    expect(result.current).toBeNull();
    expect(unread).toHaveBeenCalledTimes(0);
    expect(connect).toHaveBeenCalledTimes(0);
  });

  test("signed in it shows the count, and reads it again when the refresh key changes", async () => {
    const { api, unread, connect } = fakes(3);
    const { result, rerender } = renderHook(
      ({ refresh }) => useUnreadMessages(true, refresh, api, connect),
      { initialProps: { refresh: false } },
    );
    await waitFor(() => expect(result.current).toBe(3));
    expect([unread.mock.calls.length, connect.mock.calls.length]).toEqual([1, 1]);
    rerender({ refresh: false });
    expect(unread).toHaveBeenCalledTimes(1);
    rerender({ refresh: true });
    await waitFor(() => expect(unread).toHaveBeenCalledTimes(2));
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
