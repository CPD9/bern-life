import { describe, expect, test } from "bun:test";
import {
  closeWindow,
  cycleWindows,
  focusWindow,
  moveWindow,
  openWindow,
  topWindow,
  type WindowStack,
} from "./window-manager";

const bounds = { width: 1200, height: 800 };

function opened(...appIds: string[]): WindowStack {
  return appIds.reduce<WindowStack>((stack, appId) => openWindow(stack, appId, bounds), []);
}

describe("window manager", () => {
  test("opening cascades each new window from the top left", () => {
    expect(opened("navigator", "reports", "settings")).toEqual([
      { appId: "navigator", x: 24, y: 24 },
      { appId: "reports", x: 64, y: 56 },
      { appId: "settings", x: 104, y: 88 },
    ]);
  });

  test("opening an open app raises it without a second window", () => {
    const stack = openWindow(opened("navigator", "reports"), "navigator", bounds);
    expect(stack.map((window) => window.appId)).toEqual(["reports", "navigator"]);
    expect(topWindow(stack)).toEqual({ appId: "navigator", x: 24, y: 24 });
  });

  test("a cascade on a small desktop stays inside it", () => {
    const small = { width: 200, height: 100 };
    const stack = ["a", "b", "c"].reduce<WindowStack>((s, id) => openWindow(s, id, small), []);
    expect(stack.map(({ x, y }) => [x, y])).toEqual([
      [24, 24],
      [40, 52],
      [40, 52],
    ]);
  });

  test("closing removes only that window", () => {
    expect(closeWindow(opened("navigator", "reports"), "navigator")).toEqual([
      { appId: "reports", x: 64, y: 56 },
    ]);
  });

  test("focus brings a back window to the front and leaves the top one alone", () => {
    const stack = opened("navigator", "reports", "settings");
    expect(focusWindow(stack, "navigator").map((w) => w.appId)).toEqual([
      "reports",
      "settings",
      "navigator",
    ]);
    expect(focusWindow(stack, "settings")).toBe(stack);
    expect(focusWindow(stack, "garage")).toBe(stack);
  });

  test("cycling forward and back", () => {
    const stack = opened("navigator", "reports", "settings");
    expect(cycleWindows(stack, 1).map((w) => w.appId)).toEqual([
      "reports",
      "settings",
      "navigator",
    ]);
    expect(cycleWindows(stack, -1).map((w) => w.appId)).toEqual([
      "settings",
      "navigator",
      "reports",
    ]);
    expect(cycleWindows(opened("navigator"), 1)).toEqual([{ appId: "navigator", x: 24, y: 24 }]);
  });

  test("moving is clamped so the title bar stays on the desktop", () => {
    const stack = opened("navigator");
    expect(moveWindow(stack, "navigator", 16, -8, bounds)).toEqual([
      { appId: "navigator", x: 40, y: 16 },
    ]);
    expect(moveWindow(stack, "navigator", -500, -500, bounds)).toEqual([
      { appId: "navigator", x: 0, y: 0 },
    ]);
    expect(moveWindow(stack, "navigator", 5000, 5000, bounds)).toEqual([
      { appId: "navigator", x: 1040, y: 752 },
    ]);
  });
});
