import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { assumeWebgl } from "@/infrastructure/webgl";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { OfficeView } = await import("./office-view");

// Unmounted first, so putting WebGL back re-renders nothing outside act().
afterEach(() => {
  cleanup();
  assumeWebgl(true);
});

test("the office room offers the computer and the door", () => {
  const onUseDesk = mock(() => undefined);
  const onGoOutside = mock(() => undefined);
  render(<OfficeView lite reducedMotion onUseDesk={onUseDesk} onGoOutside={onGoOutside} />);
  expect(screen.getByRole("img", { name: /^Your office: a desk with a computer/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Use the computer" }));
  expect(onUseDesk).toHaveBeenCalledTimes(1);
  expect(onGoOutside).toHaveBeenCalledTimes(0);
  fireEvent.click(screen.getByRole("button", { name: "Go outside" }));
  expect(onGoOutside).toHaveBeenCalledTimes(1);
});

test("without WebGL the room says so, and the computer and the door still work", () => {
  assumeWebgl(false);
  const onUseDesk = mock(() => undefined);
  const onGoOutside = mock(() => undefined);
  render(<OfficeView lite reducedMotion onUseDesk={onUseDesk} onGoOutside={onGoOutside} />);
  expect(screen.queryByRole("img", { name: /^Your office/ })).toBeNull();
  expect(
    screen.getByText(
      "The office needs 3D graphics, which this browser does not offer. The computer and the door below still work.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Use the computer" }));
  fireEvent.click(screen.getByRole("button", { name: "Go outside" }));
  expect([onUseDesk.mock.calls.length, onGoOutside.mock.calls.length]).toEqual([1, 1]);
});
