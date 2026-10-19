import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Wallpaper, clockAngles } from "./wallpaper";

// 12:00 UTC on 19 October is 14:00 in Bern (summer time until the 25th).
const twoInBern = new Date("2026-10-19T12:00:00Z");
const halfPastTwo = new Date("2026-10-19T12:30:00Z");

function moving(container: HTMLElement) {
  return container.querySelectorAll('[class*="animate-"]').length;
}

function hand(container: HTMLElement, name: string) {
  return container.querySelector(`[data-hand="${name}"]`)?.getAttribute("transform") ?? null;
}

describe("Wallpaper", () => {
  test("draws the chosen scene, hidden from assistive technology", () => {
    for (const scene of ["bern", "aare", "night"] as const) {
      const { container, unmount } = render(<Wallpaper scene={scene} now={twoInBern} still />);
      const picture = container.querySelector("[data-wallpaper]")!;
      expect(picture.getAttribute("data-wallpaper")).toBe(scene);
      expect(picture.getAttribute("aria-hidden")).toBe("true");
      expect(picture.querySelectorAll("svg").length).toBe(1);
      unmount();
    }
  });

  test("plain is the gradient alone", () => {
    const { container } = render(<Wallpaper scene="plain" now={twoInBern} still={false} />);
    expect(container.querySelector("[data-wallpaper]")?.getAttribute("data-wallpaper")).toBe(
      "plain",
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  test("the Zytglogge shows Bern time, and no hands before the clock has ticked", () => {
    expect(clockAngles(twoInBern)).toEqual({ hour: 60, minute: 0 });
    expect(clockAngles(halfPastTwo)).toEqual({ hour: 75, minute: 180 });
    const { container, rerender } = render(
      <Wallpaper scene="bern" now={halfPastTwo} still={false} />,
    );
    expect(hand(container, "hour")).toBe("rotate(75 600 320)");
    expect(hand(container, "minute")).toBe("rotate(180 600 320)");
    rerender(<Wallpaper scene="bern" now={null} still={false} />);
    expect(hand(container, "hour")).toBeNull();
    expect(hand(container, "minute")).toBeNull();
  });

  test("clouds, waves and stars move, and still leaves nothing moving", () => {
    const counts = { bern: 1, aare: 4, night: 36 } as const;
    for (const scene of ["bern", "aare", "night"] as const) {
      const animated = render(<Wallpaper scene={scene} now={twoInBern} still={false} />);
      expect(moving(animated.container)).toBe(counts[scene]);
      animated.unmount();
      const still = render(<Wallpaper scene={scene} now={twoInBern} still />);
      expect(moving(still.container)).toBe(0);
      still.unmount();
    }
  });
});
