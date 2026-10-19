import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { type Door } from "./doors";
import { type MapPoint } from "./geography";
import { useWalk } from "./use-walk";
import { walkMap } from "./walk-map";

const MAP = walkMap({
  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  obstacles: [{ x: 0, z: 3, width: 4, depth: 2, angle: 0 }],
  river: [],
  riverHalfWidth: 1,
  decks: [],
  deck: { height: 1.5, endHeight: 0.2, ramp: 1 },
});
const HOME: Door = { key: "home", kind: "home", at: [-5, 0], name: "your office" };
const NONE: readonly MapPoint[] = [];

function walkFrom(start: MapPoint = HOME.at) {
  return renderHook(
    (props: { inside: boolean; framePoints: readonly MapPoint[] }) =>
      useWalk({ map: MAP, start, doors: [HOME], ...props }),
    { initialProps: { inside: false, framePoints: NONE } },
  );
}

describe("the mode switch", () => {
  test("starts on the map: keys pan, no follow camera, and your own door is offered at once", () => {
    const { result } = walkFrom();
    expect(result.current.walking).toBe(false);
    expect(result.current.keys).toBeNull();
    expect(result.current.follow).toBeNull();
    expect(result.current.door).toBe(HOME);
  });

  test("walking takes the keys and the camera follows you; Follow off gives the map back", () => {
    const { result } = walkFrom();
    act(() => result.current.toggleWalking());
    expect(result.current.keys).not.toBeNull();
    expect(result.current.follow?.()).toEqual([-5, 0, 0]);
    act(() => result.current.toggleFollowing());
    expect(result.current.follow).toBeNull();
    expect(result.current.keys).not.toBeNull();
  });

  test("a key pressed while walking wakes the resting canvas", () => {
    const { result } = walkFrom();
    let woken = 0;
    result.current.wake.current = () => void (woken += 1);
    act(() => result.current.toggleWalking());
    result.current.keys?.press("w");
    expect([...result.current.held.current]).toEqual(["w"]);
    expect(woken).toBe(1);
  });
});

describe("click-to-walk", () => {
  test("sets the path round the house and shows it from where you stand", () => {
    const { result } = walkFrom([0, 0]);
    act(() => result.current.goTo([0, 6]));
    const preview = result.current.preview ?? [];
    expect(preview[0]).toEqual([0, 0]);
    expect(preview.at(-1)).toEqual([0, 6]);
    expect(preview.length).toBeGreaterThan(2);
    expect(result.current.session.current.walker.path).toEqual(preview.slice(1));
  });

  test("Escape's stop, and leaving walk mode, drop the path and its preview", () => {
    const { result } = walkFrom([0, 0]);
    act(() => result.current.toggleWalking());
    act(() => result.current.goTo([5, 5]));
    act(() => result.current.stop());
    expect([result.current.preview, result.current.session.current.walker.path]).toEqual([
      null,
      [],
    ]);
    act(() => result.current.goTo([5, 5]));
    act(() => result.current.toggleWalking());
    expect([result.current.preview, result.current.session.current.walker.path]).toEqual([
      null,
      [],
    ]);
  });
});

describe("arriving", () => {
  test("coming out of the office puts you back at your door", () => {
    const { result, rerender } = walkFrom();
    result.current.session.current = {
      ...result.current.session.current,
      walker: { at: [6, -6], heading: 1, path: [[7, -7]] },
    };
    rerender({ inside: true, framePoints: NONE });
    expect(result.current.session.current.walker.at).toEqual([6, -6]);
    rerender({ inside: false, framePoints: NONE });
    expect(result.current.session.current.walker).toEqual({ at: [-5, 0], heading: 0, path: [] });
  });

  test("a search shown on the map lets go of the follow camera", () => {
    const { result, rerender } = walkFrom();
    act(() => result.current.toggleWalking());
    rerender({ inside: false, framePoints: [] });
    expect(result.current.following).toBe(true);
    rerender({ inside: false, framePoints: [[1, 2]] });
    expect(result.current.following).toBe(false);
    act(() => result.current.toggleWalking());
    act(() => result.current.toggleWalking());
    expect(result.current.following).toBe(true);
  });
});
