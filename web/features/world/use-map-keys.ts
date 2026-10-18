// Map keys work without first focusing the map: on the page body or anywhere in the world, but not
// while typing in a field, inside a place panel, or in an overlay like the phone that holds focus.

import { type RefObject, useEffect } from "react";
import { type CameraCommand, commandForKey } from "./camera-moves";

type MapKeys = {
  containerRef: RefObject<HTMLElement | null>;
  onCommand: (command: CameraCommand) => void;
  onEscape: () => void;
};

function focusIsOnMap(container: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (active === null || active === document.body) return true;
  return container?.contains(active) === true && active.closest("[data-place-panel]") === null;
}

export function useMapKeys({ containerRef, onCommand, onEscape }: MapKeys) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        if (containerRef.current?.contains(document.activeElement) === true) onEscape();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!focusIsOnMap(containerRef.current)) return;
      const command = commandForKey(event.key);
      if (command === null) return;
      event.preventDefault();
      onCommand(command);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [containerRef, onCommand, onEscape]);
}
