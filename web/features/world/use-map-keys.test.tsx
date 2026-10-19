import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { type CameraCommand } from "./camera-moves";
import { useMapKeys } from "./use-map-keys";
import { heldSteer, type HeldKeys, walkKey } from "./walk-keys";

function recorder() {
  const commands: CameraCommand[] = [];
  const held = new Set<string>();
  const walk: HeldKeys = {
    press: (key) => void held.add(key),
    release: (key) => void held.delete(key),
    clear: () => held.clear(),
  };
  return { commands, held, walk };
}

function MapKeys({
  onEscape = () => undefined,
  walk,
  onCommand,
}: {
  onEscape?: () => void;
  walk: HeldKeys | null;
  onCommand: (c: CameraCommand) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useMapKeys({ containerRef: container, onCommand, onEscape, walk });
  return <div ref={container} />;
}

describe("the keys in walk mode", () => {
  test("are the arrows and W A S D, in either case", () => {
    expect(["ArrowUp", "W", "a", "s", "D", "q", "+"].map(walkKey)).toEqual([
      "ArrowUp",
      "w",
      "a",
      "s",
      "d",
      null,
      null,
    ]);
  });

  test("held together walk the diagonal; opposite keys cancel", () => {
    expect(heldSteer(new Set(["w", "d"]))).toEqual({ right: 1, forward: 1 });
    expect(heldSteer(new Set(["w", "ArrowUp", "a"]))).toEqual({ right: -1, forward: 1 });
    expect(heldSteer(new Set(["a", "d"]))).toEqual({ right: 0, forward: 0 });
  });
});

describe("the mode switch", () => {
  test("on the map the movement keys pan the camera", () => {
    const { commands, held } = recorder();
    render(<MapKeys walk={null} onCommand={(command) => void commands.push(command)} />);
    act(() => void fireEvent.keyDown(window, { key: "w" }));
    expect(commands).toEqual([{ kind: "pan", right: 0, forward: 1 }]);
    expect(held.size).toBe(0);
  });

  test("walking, they are held until let go and never reach the camera; Q still turns", () => {
    const { commands, held, walk } = recorder();
    render(<MapKeys walk={walk} onCommand={(command) => void commands.push(command)} />);
    act(() => void fireEvent.keyDown(window, { key: "w" }));
    act(() => void fireEvent.keyDown(window, { key: "ArrowLeft" }));
    expect([...held]).toEqual(["w", "ArrowLeft"]);
    act(() => void fireEvent.keyUp(window, { key: "W" }));
    expect([...held]).toEqual(["ArrowLeft"]);
    act(() => void fireEvent.keyDown(window, { key: "q" }));
    expect(commands).toEqual([{ kind: "rotate", steps: -1 }]);
  });

  test("leaving the window lets go of every key, so nobody walks on alone", () => {
    const { held, walk } = recorder();
    render(<MapKeys walk={walk} onCommand={() => undefined} />);
    act(() => void fireEvent.keyDown(window, { key: "d" }));
    act(() => void fireEvent.blur(window));
    expect(held.size).toBe(0);
  });

  test("Escape stops a walk after a click on the ground left focus on the page", () => {
    let escapes = 0;
    render(
      <>
        <MapKeys walk={null} onCommand={() => undefined} onEscape={() => void (escapes += 1)} />
        <input aria-label="Elsewhere" />
      </>,
    );
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(escapes).toBe(1);
    act(() => document.querySelector("input")?.focus());
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(escapes).toBe(1);
  });
});
