"use client";

import { useEffect, useRef } from "react";

// Escape belongs to the topmost layer that wants it (a sheet over an app in the phone), wherever
// focus is, <body> included. One capture listener on document serves every layer; layers stack in
// the order they become active. A key someone already handled (defaultPrevented) is left alone, and
// a handled one is prevented, so a native <dialog> around the layer does not also close.
type Layer = { readonly escape: () => void };

const layers: Layer[] = [];

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  const top = layers.at(-1);
  if (top === undefined) return;
  event.preventDefault();
  top.escape();
}

export function useEscapeLayer(active: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const layer: Layer = { escape: () => handler.current() };
    if (layers.length === 0) document.addEventListener("keydown", onKeyDown, true);
    layers.push(layer);
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      if (layers.length === 0) document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active]);
}
