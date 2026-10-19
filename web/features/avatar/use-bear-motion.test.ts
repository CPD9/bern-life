import { expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { type Motion } from "./bear-motion";
import { useFrameOnMotionChange } from "./use-bear-motion";

test("a change of motion asks for a frame, so a still bear starts moving", () => {
  let frames = 0;
  const invalidate = () => {
    frames += 1;
  };
  const { rerender } = renderHook(
    ({ motion }: { motion: Motion }) => useFrameOnMotionChange(motion, invalidate),
    { initialProps: { motion: "still" } },
  );
  rerender({ motion: "still" });
  expect(frames).toBe(1);
  rerender({ motion: "walk" });
  rerender({ motion: "walk" });
  expect(frames).toBe(2);
  rerender({ motion: "idle" });
  expect(frames).toBe(3);
});
