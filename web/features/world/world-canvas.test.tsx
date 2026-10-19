import { expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { WorldCanvas } = await import("./world-canvas");

test("the host is told when a place's panel opens and closes", () => {
  const told: boolean[] = [];
  render(
    <WorldCanvas
      agent={{ name: "Lumi", figure: () => null }}
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
});
