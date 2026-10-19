import { describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { type AppEventName, createAppEvents } from "@/infrastructure/app-events";
import { useOfficeReady } from "./use-office-ready";

function listen() {
  const events = createAppEvents();
  const heard: AppEventName[] = [];
  events.subscribe((name) => heard.push(name));
  return { events, heard };
}

describe("useOfficeReady", () => {
  test("the first office render after onboarding reports office_ready once", () => {
    const { events, heard } = listen();
    const { rerender } = renderHook(({ shown }) => useOfficeReady(shown, events), {
      initialProps: { shown: false },
    });
    expect(heard).toEqual([]);
    rerender({ shown: true });
    rerender({ shown: true });
    rerender({ shown: false });
    rerender({ shown: true });
    expect(heard).toEqual(["office_ready"]);
  });

  test("sitting at the desk reports office_ready, even before the office was shown", () => {
    const { events, heard } = listen();
    const { result } = renderHook(() => useOfficeReady(false, events));
    result.current();
    expect(heard).toEqual(["office_ready"]);
  });
});
