import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultBear } from "./bear-config";
import { assumeWebgl } from "@/infrastructure/webgl";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { NoTurntable, Turntable } = await import("./turntable");
const { AvatarTurntable } = await import("./avatar-turntable");

const NO_WEBGL =
  "The preview needs 3D graphics, which this browser does not offer. Every choice still counts.";

// Unmounted first, so putting WebGL back re-renders nothing outside act().
afterEach(() => {
  cleanup();
  assumeWebgl(true);
});

test("with WebGL the figure turns on a plate reached by the keyboard", () => {
  render(
    <Turntable label="Turn your agent" lite focusY={0.6}>
      {null}
    </Turntable>,
  );
  const plate = screen.getByRole("slider", { name: "Turn your agent" });
  fireEvent.keyDown(plate, { key: "ArrowRight" });
  expect(plate.getAttribute("aria-valuenow")).not.toBe("0");
  expect(screen.queryByText(NO_WEBGL)).toBeNull();
});

test("without WebGL each preview says so, with no plate and nothing to try again", () => {
  assumeWebgl(false);
  render(
    <>
      <Turntable label="Turn your agent" lite focusY={0.6}>
        {null}
      </Turntable>
      <AvatarTurntable config={defaultBear} lite />
    </>,
  );
  expect(screen.getAllByText(NO_WEBGL)).toHaveLength(2);
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(document.activeElement).toBe(document.body);
});

test("a preview that stopped drawing says so, takes lost focus and can be tried again", () => {
  const onRetry = mock(() => undefined);
  render(<NoTurntable onRetry={onRetry} />);
  const note = screen.getByText("The preview stopped drawing. Every choice still counts.");
  expect(document.activeElement).toBe(note.parentElement);
  fireEvent.click(screen.getByRole("button", { name: "Try the preview again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
