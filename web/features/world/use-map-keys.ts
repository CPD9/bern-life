// Map keys work without first focusing the map: on the page body or anywhere in the world, but not
// while typing in a field or in an overlay like the phone that holds focus.

import { type RefObject, useEffect } from "react";
import { type CameraCommand, commandForKey } from "./camera-moves";

type MapKeys = {
  containerRef: RefObject<HTMLElement | null>;
  onCommand: (command: CameraCommand) => void;
};

function focusIsOnMap(container: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (active === null || active === document.body) return true;
  return container?.contains(active) === true;
}

export function useMapKeys({ containerRef, onCommand }: MapKeys) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!focusIsOnMap(containerRef.current)) return;
      const command = commandForKey(event.key);
      if (command === null) return;
      event.preventDefault();
      onCommand(command);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [containerRef, onCommand]);
}
