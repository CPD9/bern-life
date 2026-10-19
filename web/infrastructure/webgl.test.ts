import { expect, mock, test } from "bun:test";
import { probeWebgl2 } from "./webgl";

test("a browser that opens a WebGL 2 context offers WebGL, and the context is let go at once", () => {
  const loseContext = mock(() => undefined);
  const context = {
    getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null),
  };
  const asked: string[] = [];
  const offered = probeWebgl2(() => ({
    getContext: (kind: string) => {
      asked.push(kind);
      return context;
    },
  }));
  expect(offered).toBe(true);
  expect(asked).toEqual(["webgl2"]);
  expect(loseContext).toHaveBeenCalledTimes(1);
});

test("no context, or a canvas that throws, means no WebGL", () => {
  expect(probeWebgl2(() => ({ getContext: () => null }))).toBe(false);
  expect(
    probeWebgl2(() => ({
      getContext: () => {
        throw new Error("blocked");
      },
    })),
  ).toBe(false);
});

test("a context without the lose-context extension still counts", () => {
  expect(probeWebgl2(() => ({ getContext: () => ({ getExtension: () => null }) }))).toBe(true);
});
