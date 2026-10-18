"use client";

import { type CSSProperties, type PointerEvent, useEffect, useId, useRef } from "react";
import { ComingNext } from "@/infrastructure/ui/coming-next";
import { type DesktopApp, desktopComingNext } from "./desktop-apps";
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

// On a phone-sized screen only the front window shows, filling the desktop; from `sm` up the
// windows float where they were placed and can be dragged by the title bar.
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
  const drag = useRef<{ x: number; y: number } | null>(null);
  const requested = focusRequest?.appId === app.id ? focusRequest.nonce : null;

  useEffect(() => {
    if (requested !== null) heading.current?.focus();
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
      aria-labelledby={headingId}
      data-app-window={app.id}
      style={position}
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
      className={`bg-panel border-panel-border absolute inset-0 flex flex-col overflow-hidden border sm:inset-auto sm:top-(--y) sm:left-(--x) sm:h-[min(42rem,calc(100%-3rem))] sm:w-[min(40rem,calc(100%-3rem))] sm:rounded-3xl ${
        focused ? "shadow-panel" : "max-sm:hidden sm:opacity-95"
      }`}
    >
      <header
        onPointerDown={startDrag}
        onPointerMove={dragTo}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className={`border-panel-border flex touch-none items-center gap-3 border-b px-4 py-2 sm:cursor-grab ${
          focused ? "bg-chip" : ""
        }`}
      >
        <span
          aria-hidden="true"
          style={{ backgroundColor: app.tile }}
          className="size-3 shrink-0 rounded-full"
        />
        <h2 ref={heading} id={headingId} tabIndex={-1} className="flex-1 text-lg font-extrabold">
          {app.label}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${app.label}`}
          className="rounded-pill hover:bg-panel px-3 py-1 font-bold"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {app.content ?? <ComingNext text={desktopComingNext[app.id]} />}
      </div>
    </section>
  );
}
