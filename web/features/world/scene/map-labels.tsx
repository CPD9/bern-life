// District and river names as page text over the canvas, in the page's own font, moved each frame
// by the same projector as the markers. The layer is made here, beside the canvas, because the
// scene owns no DOM of its own; it sits under the marker layer and never takes a pointer.

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { MAP_LABELS } from "../geography";
import { type Anchor } from "../markers/anchors";
import { AnchorProjector } from "../markers/anchor-projector";

const LABEL_Y = 0.3;

const ANCHORS: readonly Anchor[] = MAP_LABELS.map((label) => ({
  key: label.key,
  position: [label.at[0], LABEL_Y, label.at[1]],
}));

const LAYER_CLASS = "pointer-events-none absolute inset-0 isolate overflow-hidden select-none";
const LABEL_CLASS =
  "invisible absolute top-0 left-0 whitespace-nowrap text-[11px] font-extrabold tracking-[0.18em] text-ink/70 uppercase";
const RIVER_CLASS =
  "invisible absolute top-0 left-0 whitespace-nowrap text-xs font-bold tracking-[0.3em] text-ink/60 italic";

export function MapLabels() {
  const host = useThree((state) => state.gl.domElement.parentElement);
  const invalidate = useThree((state) => state.invalidate);
  const elementsRef = useRef(new Map<string, HTMLElement>());

  useLayoutEffect(() => {
    if (host === null) return;
    const elements = elementsRef.current;
    const layer = document.createElement("div");
    layer.className = LAYER_CLASS;
    layer.setAttribute("aria-hidden", "true");
    for (const label of MAP_LABELS) {
      const element = document.createElement("span");
      element.className = label.district === null ? RIVER_CLASS : LABEL_CLASS;
      element.style.textShadow = "0 0 3px var(--panel), 0 0 6px var(--panel)";
      element.textContent = label.name;
      layer.append(element);
      elements.set(label.key, element);
    }
    host.append(layer);
    invalidate();
    return () => {
      layer.remove();
      elements.clear();
    };
  }, [host, invalidate]);

  return <AnchorProjector anchors={ANCHORS} elementsRef={elementsRef} />;
}
