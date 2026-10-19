// Map keys work without first focusing the map: on the page body or anywhere in the world, but not
// while typing in a field, inside a place panel, or in an overlay like the phone that holds focus.
// In walk mode the movement keys walk you while held instead of panning the map.

import { type RefObject, useEffect } from "react";
import { type CameraCommand, commandForKey } from "./camera-moves";
import { type HeldKeys, walkKey } from "./walk-keys";

type MapKeys = {
  containerRef: RefObject<HTMLElement | null>;
  onCommand: (command: CameraCommand) => void;
  onEscape: () => void;
  /** Present in walk mode: the movement keys go here instead of to the camera. */
  walk?: HeldKeys | null;
};

function focusIsOnMap(container: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (active === null || active === document.body) return true;
  return container?.contains(active) === true && active.closest("[data-place-panel]") === null;
}

export function useMapKeys({ containerRef, onCommand, onEscape, walk = null }: MapKeys) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        if (containerRef.current?.contains(document.activeElement) === true) onEscape();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!focusIsOnMap(containerRef.current)) return;
      const held = walk === null ? null : walkKey(event.key);
      if (walk !== null && held !== null) {
        event.preventDefault();
        walk.press(held);
        return;
      }
      const command = commandForKey(event.key);
      if (command === null) return;
      event.preventDefault();
      onCommand(command);
    }
    // A key let go anywhere stops you, even after focus has moved on, and so does leaving the window.
    function onKeyUp(event: KeyboardEvent) {
      const held = walkKey(event.key);
      if (walk !== null && held !== null) walk.release(held);
    }
    const stop = () => walk?.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stop);
      stop();
    };
  }, [containerRef, onCommand, onEscape, walk]);
}
