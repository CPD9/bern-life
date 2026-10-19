// The desk and the door answer the pointer. The room keeps which one is pointed at, so the canvas
// shows a hand cursor and the piece glows; every handler stops the event, so a click on the
// computer never also reaches the floor behind it.

import { type ThreeEvent } from "@react-three/fiber";

export type HotspotId = "desk" | "door";

export type HotspotHandlers = {
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

export function hotspot(
  id: HotspotId,
  onActivate: () => void,
  onPoint: (id: HotspotId | null) => void,
): HotspotHandlers {
  return {
    onClick: (event) => {
      event.stopPropagation();
      onActivate();
    },
    onPointerOver: (event) => {
      event.stopPropagation();
      onPoint(id);
    },
    onPointerOut: (event) => {
      event.stopPropagation();
      onPoint(null);
    },
  };
}
