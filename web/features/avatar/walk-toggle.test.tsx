import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { WalkToggle } from "./walk-toggle";

function renderToggle(walking: boolean, reducedMotion: boolean) {
  let toggles = 0;
  render(
    <WalkToggle
      walking={walking}
      reducedMotion={reducedMotion}
      onToggle={() => {
        toggles += 1;
      }}
    />,
  );
  const button = screen.getByRole<HTMLButtonElement>("button", { name: "Walk" });
  fireEvent.click(button);
  return { button, toggles: () => toggles };
}

describe("WalkToggle", () => {
  test("pressing Walk toggles walking", () => {
    const { button, toggles } = renderToggle(true, false);
    expect([button.getAttribute("aria-pressed"), button.disabled]).toEqual(["true", false]);
    expect(toggles()).toBe(1);
    expect(screen.queryByText(/reduced motion/)).toBeNull();
  });

  test("under reduced motion Walk is disabled, not pressed, and a note says why", () => {
    const { button, toggles } = renderToggle(true, true);
    expect([button.getAttribute("aria-pressed"), button.disabled]).toEqual(["false", true]);
    expect(toggles()).toBe(0);
    const note = screen.getByText("Off while your device asks for reduced motion");
    expect(button.getAttribute("aria-describedby")).toBe(note.id);
  });
});
