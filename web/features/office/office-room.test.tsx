import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { assumeWebgl } from "@/infrastructure/webgl";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { OfficeRoom } = await import("./office-room");

function renderRoom() {
  const calls: string[] = [];
  render(
    <OfficeRoom
      lite
      reducedMotion
      onUseDesk={() => calls.push("desk")}
      onGoOutside={() => calls.push("outside")}
    />,
  );
  return calls;
}

describe("OfficeRoom", () => {
  test("Use the computer sits the player down at the desk", () => {
    const calls = renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "Use the computer" }));
    expect(calls).toEqual(["desk"]);
  });

  test("Go outside leaves the office", () => {
    const calls = renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "Go outside" }));
    expect(calls).toEqual(["outside"]);
  });

  test("the room is described for screen readers", () => {
    renderRoom();
    expect(screen.getByRole("img", { name: /^Your office: a desk with a computer/ })).toBeTruthy();
  });

  test("a visited office is read-only: named for its owner, with no way to use it", () => {
    render(<OfficeRoom lite reducedMotion visiting="Lena Beispiel" />);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(
      screen.getByRole("img", { name: /^Lena Beispiel's office, as a visitor sees it: a desk/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Your office/ })).toBeNull();
  });

  describe("without WebGL", () => {
    // Unmounted first, so putting WebGL back re-renders nothing outside act().
    afterEach(() => {
      cleanup();
      assumeWebgl(true);
    });

    test("a visited office says so, with no promise of buttons it does not have", () => {
      assumeWebgl(false);
      render(<OfficeRoom lite reducedMotion visiting="Lena Beispiel" />);
      expect(
        screen.getByText(
          "Lena Beispiel's office needs 3D graphics, which this browser does not offer.",
        ),
      ).toBeTruthy();
      expect(screen.queryAllByRole("button")).toEqual([]);
    });
  });
});
