import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { assumeWebgl } from "@/infrastructure/webgl";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { SceneGuard, useLoseScene, watchContextLoss } = await import("./scene-guard");

// Unmounted first, so putting WebGL back re-renders nothing outside act().
afterEach(() => {
  cleanup();
  assumeWebgl(true);
});

function fallback(retry: (() => void) | null) {
  return (
    <div>
      <p>No 3D here</p>
      {retry && (
        <button type="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

test("without WebGL the fallback shows, with no retry, and the scene never mounts", () => {
  assumeWebgl(false);
  const mounted = mock(() => undefined);
  function Scene() {
    mounted();
    return null;
  }
  render(
    <SceneGuard fallback={fallback}>
      <Scene />
    </SceneGuard>,
  );
  expect(screen.getByText("No 3D here")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(mounted).toHaveBeenCalledTimes(0);
});

test("a scene that throws gives way to the fallback; trying again mounts it anew", () => {
  const quiet = spyOn(console, "error").mockImplementation(() => undefined);
  try {
    let broken = true;
    function Scene() {
      if (broken) throw new Error("shader failed to compile");
      return <p>The scene</p>;
    }
    render(
      <SceneGuard fallback={fallback}>
        <Scene />
      </SceneGuard>,
    );
    expect(screen.getByText("No 3D here")).toBeTruthy();
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("The scene")).toBeTruthy();
  } finally {
    quiet.mockRestore();
  }
});

test("a scene can give itself up, as when its context is lost for good", () => {
  function Scene() {
    const lose = useLoseScene();
    return (
      <button type="button" onClick={() => lose?.()}>
        Lose the context
      </button>
    );
  }
  render(
    <SceneGuard fallback={fallback}>
      <Scene />
    </SceneGuard>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Lose the context" }));
  expect(screen.getByText("No 3D here")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function canvasInPage(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  return canvas;
}

test("a lost context that does not come back gives the scene up", async () => {
  const canvas = canvasInPage();
  const onGiveUp = mock(() => undefined);
  const stop = watchContextLoss(canvas, { onGiveUp, onRestored: () => undefined, waitMs: 5 });
  canvas.dispatchEvent(new Event("webglcontextlost"));
  expect(onGiveUp).toHaveBeenCalledTimes(0);
  await wait(30);
  expect(onGiveUp).toHaveBeenCalledTimes(1);
  stop();
  canvas.remove();
});

test("a context given back in time draws again and keeps the scene", async () => {
  const canvas = canvasInPage();
  const onGiveUp = mock(() => undefined);
  const onRestored = mock(() => undefined);
  const stop = watchContextLoss(canvas, { onGiveUp, onRestored, waitMs: 20 });
  canvas.dispatchEvent(new Event("webglcontextlost"));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  await wait(50);
  expect(onRestored).toHaveBeenCalledTimes(1);
  expect(onGiveUp).toHaveBeenCalledTimes(0);
  stop();
  canvas.remove();
});

test("a canvas let go on purpose, or no longer watched, is not a loss", async () => {
  const onGiveUp = mock(() => undefined);
  // Out of the page: lite graphics remount the renderer and release the old one's context.
  const released = document.createElement("canvas");
  const stopReleased = watchContextLoss(released, {
    onGiveUp,
    onRestored: () => undefined,
    waitMs: 5,
  });
  released.dispatchEvent(new Event("webglcontextlost"));
  // Still in the page but unwatched, as once the scene has unmounted.
  const unwatched = canvasInPage();
  watchContextLoss(unwatched, { onGiveUp, onRestored: () => undefined, waitMs: 5 })();
  unwatched.dispatchEvent(new Event("webglcontextlost"));
  await wait(30);
  expect(onGiveUp).toHaveBeenCalledTimes(0);
  stopReleased();
  unwatched.remove();
});
