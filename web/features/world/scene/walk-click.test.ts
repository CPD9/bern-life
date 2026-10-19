import { describe, expect, mock, test } from "bun:test";
import { Vector3 } from "three";
import { type MapPoint } from "../geography";
import { CLICK_SLOP, walkClick } from "./walk-click";

function clicked(delta: number) {
  return { delta, point: new Vector3(4, 1.5, -2), stopPropagation: mock(() => undefined) };
}

describe("a click in walk mode", () => {
  test("walks to the spot clicked and goes no further than the thing it landed on", () => {
    const walked: MapPoint[] = [];
    const event = clicked(0);
    walkClick((point) => void walked.push(point)).onClick?.(event);
    expect(walked).toEqual([[4, -2]]);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  test("a drag walks nowhere, and the ground behind does not take it either", () => {
    const walked: MapPoint[] = [];
    const event = clicked(CLICK_SLOP + 1);
    walkClick((point) => void walked.push(point)).onClick?.(event);
    expect(walked).toEqual([]);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  test("outside walk mode nothing listens, so nothing is hit-tested", () => {
    expect(walkClick(undefined)).toEqual({});
  });
});
