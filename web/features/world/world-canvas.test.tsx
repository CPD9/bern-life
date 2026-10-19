import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { assumeWebgl } from "@/infrastructure/webgl";
import { resultFixture } from "@/test/fixtures";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { WorldCanvas } = await import("./world-canvas");
const { worldSearch } = await import("./world-search");

const NO_MAP =
  "The map needs 3D graphics, which this browser does not offer. Ask, the office desk and every app still work.";

// Unmounted first, so putting WebGL back re-renders nothing outside act().
afterEach(() => {
  cleanup();
  assumeWebgl(true);
  worldSearch.clear();
});

type WorldProps = { demoSearch?: SearchResponse; onPlacePanel?: (open: boolean) => void };

function renderWorld(props: WorldProps = {}) {
  const onOpenAsk = mock(() => undefined);
  const onOpenDesk = mock(() => undefined);
  const world = (shown: WorldProps) => (
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
      onAgentOpen={() => undefined}
      onOpenAsk={onOpenAsk}
      onOpenDesk={onOpenDesk}
      {...shown}
    />
  );
  const { rerender } = render(world(props));
  return { onOpenAsk, onOpenDesk, rerender: (next: WorldProps) => rerender(world(next)) };
}

test("the host is told when a place's panel opens and closes", () => {
  const told: boolean[] = [];
  renderWorld({ onPlacePanel: (open) => void told.push(open) });
  expect(told).toEqual([false]);
  const place = document.querySelector<HTMLButtonElement>("[data-building]")!;
  act(() => fireEvent.click(place));
  expect(document.querySelector("[data-place-panel]")).not.toBeNull();
  expect(told).toEqual([false, true]);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
  expect(document.querySelector("[data-place-panel]")).toBeNull();
  expect(told).toEqual([false, true, false]);
});

test("without WebGL a card stands where the map was and opens Ask and the office desk", () => {
  assumeWebgl(false);
  const { onOpenAsk, onOpenDesk } = renderWorld();
  expect(screen.getByText(NO_MAP)).toBeTruthy();
  expect(document.querySelector("canvas")).toBeNull();
  expect(document.querySelector("[data-building]")).toBeNull();
  // Trying again cannot help a browser that offers no WebGL at all.
  expect(screen.queryByRole("button", { name: "Try the map again" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open Ask" }));
  expect(onOpenAsk).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Open the office desk" }));
  expect(onOpenDesk).toHaveBeenCalledTimes(1);
});

test("a map that throws gives way to the same card, with a way to try again", () => {
  // React reports the caught error on the console; the test needs only the card.
  const quiet = spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const broken = { ...resultFixture, results: null } as unknown as SearchResponse;
    const told: boolean[] = [];
    const onPlacePanel = (open: boolean) => void told.push(open);
    const { onOpenDesk, rerender } = renderWorld({ demoSearch: broken, onPlacePanel });
    expect(screen.getByText(NO_MAP)).toBeTruthy();
    expect(document.querySelector("[data-building]")).toBeNull();
    // The map's last word to the host is that no panel is open.
    expect(told.at(-1)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open the office desk" }));
    expect(onOpenDesk).toHaveBeenCalledTimes(1);

    // Once what broke it is gone, trying again brings the map back.
    rerender({ onPlacePanel });
    act(() => worldSearch.clear());
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try the map again" })));
    expect(screen.queryByText(NO_MAP)).toBeNull();
    expect(document.querySelector("[data-building]")).not.toBeNull();
  } finally {
    quiet.mockRestore();
  }
});
