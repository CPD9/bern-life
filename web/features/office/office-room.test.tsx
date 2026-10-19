import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";

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
});
