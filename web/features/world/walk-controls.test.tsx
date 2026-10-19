import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { type Door } from "./doors";
import { WalkControls } from "./walk-controls";

const LAB: Door = { key: "musterstrasse 5", kind: "place", at: [1, 2], name: "Example Sensor Lab" };
const HOME: Door = { key: "home", kind: "home", at: [3, 4], name: "your office" };

function controls(door: Door | null, walking = true) {
  const onEnter = mock((entered: Door) => entered.key);
  const onWalkHome = mock(() => undefined);
  render(
    <WalkControls
      walking={walking}
      onToggleWalking={() => undefined}
      following
      onToggleFollowing={() => undefined}
      door={door}
      onEnter={onEnter}
      onWalkHome={onWalkHome}
    />,
  );
  return { onEnter, onWalkHome };
}

function buttons(): string[] {
  return screen.getAllByRole("button").map((button) => button.textContent ?? "");
}

describe("the walking controls", () => {
  test("on the map: only Walk, not pressed; Follow comes with walking", () => {
    controls(null, false);
    expect(buttons()).toEqual(["Walk"]);
    expect(screen.getByRole("button", { name: "Walk" }).getAttribute("aria-pressed")).toBe("false");
  });

  test("at a place's door, Enter is a button that goes in only when pressed", () => {
    const { onEnter } = controls(LAB);
    expect(buttons()).toEqual(["Walk", "Follow", "Walk home", "Enter Example Sensor Lab"]);
    expect(screen.getByText("At the door of Example Sensor Lab")).toBeTruthy();
    expect(onEnter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enter Example Sensor Lab" }));
    expect(onEnter.mock.calls).toEqual([[LAB]]);
  });

  test("at your own door, Go home replaces Walk home", () => {
    const { onEnter } = controls(HOME);
    expect(buttons()).toEqual(["Walk", "Follow", "Go home"]);
    expect(screen.getByText("At your office door")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    expect(onEnter.mock.calls).toEqual([[HOME]]);
  });

  test("Walk home walks you there", () => {
    const { onWalkHome } = controls(null);
    fireEvent.click(screen.getByRole("button", { name: "Walk home" }));
    expect(onWalkHome).toHaveBeenCalledTimes(1);
  });
});
