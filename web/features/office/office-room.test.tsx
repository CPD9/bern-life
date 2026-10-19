import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { OfficeRoom } from "./office-room";

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
});
