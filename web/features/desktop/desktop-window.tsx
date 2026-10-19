"use client";

import { type CSSProperties, type PointerEvent, useEffect, useId, useRef } from "react";
import { focusOnOpen } from "@/infrastructure/ui/focus-on-open";
import type { DesktopApp } from "./desktop-apps";
import type { FocusRequest } from "./use-desktop";
import type { DesktopWindow as WindowPlace } from "./window-manager";

type DesktopWindowProps = {
  app: DesktopApp;
  place: WindowPlace;
  layer: number;
  focused: boolean;
  focusRequest: FocusRequest | null;
  onFocus: () => void;
  onClose: () => void;
  onMove: (dx: number, dy: number) => void;
};

const trafficLight = "size-3 shrink-0 rounded-full";

// A Mac window: a 38 pt title bar with the close light at the left and the title centred, dragged
// by the title bar. On a phone-sized screen only the front window shows, filling the desktop;
// from `sm` up the windows float where they were placed.
export function DesktopWindow({
  app,
  place,
  layer,
  focused,
  focusRequest,
  onFocus,
  onClose,
  onMove,
}: DesktopWindowProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const frame = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const requested = focusRequest?.appId === app.id ? focusRequest.nonce : null;

  useEffect(() => {
    if (requested !== null) focusOnOpen(frame.current, heading.current);
  }, [requested]);

  function startDrag(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function dragTo(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    onMove(event.clientX - drag.current.x, event.clientY - drag.current.y);
    drag.current = { x: event.clientX, y: event.clientY };
  }

  const position = { "--x": `${place.x}px`, "--y": `${place.y}px`, zIndex: layer } as CSSProperties;

  return (
    <section
      ref={frame}
      aria-labelledby={headingId}
      data-app-window={app.id}
      style={position}
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
      className={`bg-panel border-panel-border absolute inset-0 flex flex-col overflow-hidden border sm:inset-auto sm:top-(--y) sm:left-(--x) sm:h-[min(42rem,calc(100%-3rem))] sm:w-[min(40rem,calc(100%-3rem))] sm:rounded-xl ${
        focused ? "shadow-[0_16px_48px_var(--shadow-color)]" : "shadow-panel max-sm:hidden"
      }`}
    >
      <header
        onPointerDown={startDrag}
        onPointerMove={dragTo}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className={`border-panel-border relative flex h-[38px] shrink-0 touch-none items-center border-b px-4 sm:cursor-grab ${
          focused ? "bg-chip" : ""
        }`}
      >
        <div className="group flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${app.label}`}
            className={`${trafficLight} flex items-center justify-center bg-[#ff5f57] ring-1 ring-black/10 ring-inset`}
          >
            <span
              aria-hidden="true"
              className="text-[9px] leading-none font-bold text-black/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              ✕
            </span>
          </button>
          <span
            aria-hidden="true"
            className={`${trafficLight} bg-chip border-panel-border border`}
          />
          <span
            aria-hidden="true"
            className={`${trafficLight} bg-chip border-panel-border border`}
          />
        </div>
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className={`absolute inset-x-20 top-1/2 -translate-y-1/2 truncate text-center text-[13px] font-semibold outline-none ${
            focused ? "text-ink" : "text-muted"
          }`}
        >
          {app.label}
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{app.content}</div>
    </section>
  );
}
