import { expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { appEvents } from "@/infrastructure/app-events";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { WorldCanvas } = await import("./world-canvas");

test("the host is told when a place's panel opens and closes; the story only when you go in", () => {
  const told: boolean[] = [];
  const heard: string[] = [];
  const unsubscribe = appEvents.subscribe((name) => void heard.push(name));
  render(
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
      player={{ figure: () => null, home: null, inside: false }}
      onAgentOpen={() => undefined}
      onPlacePanel={(open) => void told.push(open)}
    />,
  );
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
  render(
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
      player={{ figure: () => null, home: [-50, 25], inside: false }}
      onAgentOpen={() => undefined}
      onGoHome={() => void (wentHome += 1)}
    />,
  );
  expect(wentHome).toBe(0);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Go home" })));
  expect(wentHome).toBe(1);
  expect(heard).toEqual([]);
  unsubscribe();
});

test("in your office the map under the room is inert; out of it, it is not", () => {
  const canvas = (inside: boolean) => (
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
      player={{ figure: () => null, home: [-50, 25], inside }}
      onAgentOpen={() => undefined}
    />
  );
  const { rerender } = render(canvas(true));
  const map = () => document.querySelector('[aria-label="Map of Bern"]')?.hasAttribute("inert");
  expect(map()).toBe(true);
  rerender(canvas(false));
  expect(map()).toBe(false);
});

test("Walk switches the keys from the map to you, and a place offers to walk you there", () => {
  render(
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
      player={{ figure: () => null, home: null, inside: false }}
      onAgentOpen={() => undefined}
    />,
  );
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
