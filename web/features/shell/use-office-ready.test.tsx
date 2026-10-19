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
    const { rerender } = renderHook(
      ({ shown, onboarded }) => useOfficeReady(shown, onboarded, events),
      { initialProps: { shown: true, onboarded: false } },
    );
    expect(heard).toEqual([]);
    rerender({ shown: false, onboarded: true });
    expect(heard).toEqual([]);
    rerender({ shown: true, onboarded: true });
    rerender({ shown: true, onboarded: true });
    rerender({ shown: false, onboarded: true });
    rerender({ shown: true, onboarded: true });
    expect(heard).toEqual(["office_ready"]);
  });

  test("sitting at the desk reports office_ready only once onboarded", () => {
    const { events, heard } = listen();
    const { result, rerender } = renderHook(
      ({ onboarded }) => useOfficeReady(false, onboarded, events),
      { initialProps: { onboarded: false } },
    );
    result.current();
    expect(heard).toEqual([]);
    rerender({ onboarded: true });
    result.current();
    expect(heard).toEqual(["office_ready"]);
  });
});
