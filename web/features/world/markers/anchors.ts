// Labels and buttons live in the page's own DOM, above the canvas, and follow points in the scene.
// Each anchored element registers itself here; the projector inside the canvas moves it.

import { type RefObject } from "react";

export type Anchor = { readonly key: string; readonly position: readonly [number, number, number] };

export type AnchorElements = RefObject<Map<string, HTMLElement>>;

/** Ref callback that keeps the element map current as anchored elements mount and unmount. */
export function registerAnchor(elementsRef: AnchorElements, key: string) {
  return (element: HTMLElement | null) => {
    if (element === null) {
      elementsRef.current.delete(key);
    } else {
      elementsRef.current.set(key, element);
    }
  };
}
