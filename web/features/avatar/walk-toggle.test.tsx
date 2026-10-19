import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { WalkToggle, useWalking } from "./walk-toggle";

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
    expect([button.getAttribute("aria-pressed"), button.getAttribute("aria-disabled")]).toEqual([
      "true",
      "false",
    ]);
    expect(toggles()).toBe(1);
    expect(screen.queryByText(/reduced motion/)).toBeNull();
  });

  test("under reduced motion Walk is unavailable, not pressed, and a note says why", () => {
    const { button, toggles } = renderToggle(true, true);
    expect([button.getAttribute("aria-pressed"), button.getAttribute("aria-disabled")]).toEqual([
      "false",
      "true",
    ]);
    expect(toggles()).toBe(0);
    const note = screen.getByText("Off while your device asks for reduced motion");
    expect(button.getAttribute("aria-describedby")).toBe(note.id);
  });

  test("under reduced motion Walk stays in the tab order, so the note can be reached", () => {
    const { button } = renderToggle(false, true);
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

describe("useWalking", () => {
  test("Walk toggles on and off", () => {
    const { result } = renderHook(() => useWalking(false));
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });

  test("reduced motion switches Walk off, and it stays off when the setting is lifted", () => {
    const { result, rerender } = renderHook(({ reduced }) => useWalking(reduced), {
      initialProps: { reduced: false },
    });
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    rerender({ reduced: true });
    expect(result.current[0]).toBe(false);
    rerender({ reduced: false });
    expect(result.current[0]).toBe(false);
  });
});
