import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { assumeWebgl } from "@/infrastructure/webgl";
import { resultFixture } from "@/test/fixtures";
import type { MapPoint } from "./geography";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { WorldCanvas } = await import("./world-canvas");
const { worldSearch } = await import("./world-search");

const NO_MAP =
  "The map needs 3D graphics, which this browser does not offer. Ask, the office desk and every app still work.";
// A map that threw or lost its context: the browser is not to blame, and trying again may help.
const STOPPED = "The map stopped drawing. Ask, the office desk and every app still work.";
/** An office plot; on load you stand at its door. */
const HOME: MapPoint = [-50, 25];

// Unmounted first, so putting WebGL back re-renders nothing outside act().
afterEach(() => {
  cleanup();
  assumeWebgl(true);
  worldSearch.clear();
});

type WorldProps = {
  demoSearch?: SearchResponse;
  onPlacePanel?: (open: boolean) => void;
  onGoHome?: () => void;
  /** Your office plot; none unless given. */
  home?: MapPoint;
  /** In your office, which covers the map. */
  inside?: boolean;
};

function renderWorld(props: WorldProps = {}) {
  const onOpenAsk = mock(() => undefined);
  const onOpenDesk = mock(() => undefined);
  const world = ({ home, inside = false, ...shown }: WorldProps) => (
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
      player={{ figure: () => null, home: home ?? null, inside }}
      onAgentOpen={() => undefined}
      onOpenAsk={onOpenAsk}
      onOpenDesk={onOpenDesk}
      {...shown}
    />
  );
  const { rerender } = render(world(props));
  return { onOpenAsk, onOpenDesk, rerender: (next: WorldProps) => rerender(world(next)) };
}

test("the host is told when a place's panel opens and closes; the story only when you go in", () => {
  const told: boolean[] = [];
  const heard: string[] = [];
  const unsubscribe = appEvents.subscribe((name) => void heard.push(name));
  renderWorld({ onPlacePanel: (open) => void told.push(open) });
  expect(told).toEqual([false]);
  const place = document.querySelector<HTMLButtonElement>("[data-building]")!;
  act(() => fireEvent.click(place));
  expect(document.querySelector("[data-place-panel]")).not.toBeNull();
  expect(told).toEqual([false, true]);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
  expect(document.querySelector("[data-place-panel]")).toBeNull();
  expect(told).toEqual([false, true, false]);
  expect(heard).toEqual([]);
  unsubscribe();
});

test("at your door on load, Go home is offered and takes you in only when pressed", () => {
  const heard: string[] = [];
  const unsubscribe = appEvents.subscribe((name) => void heard.push(name));
  let wentHome = 0;
  renderWorld({ home: HOME, onGoHome: () => void (wentHome += 1) });
  expect(wentHome).toBe(0);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Go home" })));
  expect(wentHome).toBe(1);
  expect(heard).toEqual([]);
  unsubscribe();
});

test("in your office the map under the room is inert; out of it, it is not", () => {
  const { rerender } = renderWorld({ home: HOME, inside: true });
  const map = () => document.querySelector('[aria-label="Map of Bern"]')?.hasAttribute("inert");
  expect(map()).toBe(true);
  rerender({ home: HOME, inside: false });
  expect(map()).toBe(false);
});

test("Walk switches the keys from the map to you, and a place offers to walk you there", () => {
  renderWorld();
  const keys = () => document.getElementById("map-keys")?.textContent ?? "";
  expect(keys()).toStartWith("Arrow keys or W A S D pan");
  expect(screen.queryByRole("button", { name: "Go home" })).toBeNull();
  act(() => fireEvent.click(document.querySelector<HTMLButtonElement>("[data-building]")!));
  expect(screen.queryByRole("button", { name: "Walk here" })).toBeNull();
  act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
  act(() => fireEvent.click(screen.getByRole("button", { name: "Walk" })));
  expect(keys()).toStartWith("Arrow keys or W A S D walk");
  expect(screen.getByRole("button", { name: "Follow" }).getAttribute("aria-pressed")).toBe("true");
  act(() => fireEvent.click(document.querySelector<HTMLButtonElement>("[data-building]")!));
  expect(screen.getByRole("button", { name: "Walk here" })).toBeTruthy();
});

test("without WebGL, walking goes with the map: no Walk, no door, no Go home at your door", () => {
  assumeWebgl(false);
  renderWorld({ home: HOME });
  expect(screen.getByText(NO_MAP)).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Walking" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Walk" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Go home" })).toBeNull();
  expect(document.querySelector("[data-door], [data-walk-toggle]")).toBeNull();
  expect(document.getElementById("map-keys")).toBeNull();
});

test("without WebGL a card stands where the map was and opens Ask and the office desk", () => {
  assumeWebgl(false);
  const { onOpenAsk, onOpenDesk } = renderWorld();
  expect(screen.getByText(NO_MAP)).toBeTruthy();
  expect(document.querySelector("canvas")).toBeNull();
  expect(document.querySelector("[data-building]")).toBeNull();
  // Trying again cannot help a browser that offers no WebGL at all.
  expect(screen.queryByRole("button", { name: "Try the map again" })).toBeNull();
  // Nothing was lost at load, so the card leaves focus where the page put it.
  expect(document.activeElement).toBe(document.body);
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
    expect(screen.getByText(STOPPED)).toBeTruthy();
    expect(screen.queryByText(NO_MAP)).toBeNull();
    expect(document.querySelector("[data-building]")).toBeNull();
    // Focus that went with the map lands on its card.
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Map of Bern" }));
    // The map's last word to the host is that no panel is open.
    expect(told.at(-1)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open the office desk" }));
    expect(onOpenDesk).toHaveBeenCalledTimes(1);

    // Once what broke it is gone, trying again brings the map back.
    rerender({ onPlacePanel });
    act(() => worldSearch.clear());
    const retry = screen.getByRole("button", { name: "Try the map again" });
    act(() => retry.focus());
    act(() => fireEvent.click(retry));
    expect(screen.queryByText(STOPPED)).toBeNull();
    expect(document.querySelector("[data-building]")).not.toBeNull();
    // The button went with the card; the map's region takes the focus it held.
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Map of Bern" }));
    expect(document.activeElement!.querySelector("canvas")).not.toBeNull();
  } finally {
    quiet.mockRestore();
  }
});

test("a map that stops drawing behind the office leaves focus alone", () => {
  const quiet = spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const broken = { ...resultFixture, results: null } as unknown as SearchResponse;
    renderWorld({ demoSearch: broken, home: HOME, inside: true });
    expect(screen.getByText(STOPPED)).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  } finally {
    quiet.mockRestore();
  }
});

test("while the office covers it, the card and its buttons are out of the tab order", () => {
  assumeWebgl(false);
  const { rerender } = renderWorld({ home: HOME, inside: true });
  const card = screen.getByText(NO_MAP).closest("section")!;
  const button = screen.getByRole("button", { name: "Open Ask" });
  expect(button.closest("[inert]")).not.toBeNull();
  expect(card.closest("[inert]")).not.toBeNull();
  // Uncovered, the card's buttons are reachable again.
  rerender({ home: HOME, inside: false });
  expect(button.closest("[inert]")).toBeNull();
});
