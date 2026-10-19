import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { defaultBear } from "@/features/avatar/bear-config";
import { defaultPerson } from "@/features/avatar/person-config";
import { type Plot, PLOTS } from "@/features/settle/plots";
import type { WorldView } from "@/features/shell/game-shell";
import { assumeWebgl } from "@/infrastructure/webgl";

// three.js has to finish loading as a module before the canvas library requires it.
await import("three");
const { WorldScene } = await import("./world-scene");

/** The scene as the app hosts it: Go home shows the office, Go outside the map. */
function Host({ plot, first }: { plot: Plot | null; first: WorldView }) {
  const [view, setView] = useState(first);
  return (
    <WorldScene
      view={view}
      demoSearch={undefined}
      person={defaultPerson}
      bear={defaultBear}
      agentName="Bärnli"
      plot={plot}
      lite
      reducedMotion
      onAgentOpen={() => undefined}
      onSearchHere={() => undefined}
      onPlacePanel={() => undefined}
      onUseDesk={() => undefined}
      onGoOutside={() => setView("map")}
      onGoHome={() => setView("home")}
      onOpenAsk={() => undefined}
    />
  );
}

const focused = () => document.activeElement?.textContent;

// Unmounted first, so putting WebGL back re-renders nothing outside act().
afterEach(() => {
  cleanup();
  assumeWebgl(true);
});

test("focus follows you through your office door: in to the way out, out to Go home", () => {
  render(<Host plot={PLOTS[0] ?? null} first="map" />);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Go home" })));
  expect(document.activeElement?.hasAttribute("data-office-exit")).toBe(true);
  expect(focused()).toBe("Go outside");
  act(() => fireEvent.click(screen.getByRole("button", { name: "Go outside" })));
  expect(document.activeElement?.getAttribute("data-door")).toBe("home");
  expect(focused()).toBe("Go home");
});

test("out of the office with no door of your own to stand at, focus goes to Walk", () => {
  render(<Host plot={null} first="home" />);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Go outside" })));
  expect(document.activeElement?.hasAttribute("data-walk-toggle")).toBe(true);
  expect(focused()).toBe("Walk");
});

test("without 3D there is no door to walk to: out of the office, focus lands on the map's card", () => {
  assumeWebgl(false);
  render(<Host plot={PLOTS[0] ?? null} first="home" />);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Go outside" })));
  expect(screen.queryByRole("button", { name: "Go home" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Walk" })).toBeNull();
  expect(document.activeElement?.hasAttribute("data-no-map")).toBe(true);
  expect(document.activeElement?.closest("[inert]")).toBeNull();
});
