"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";
import { formatBernTime } from "@/infrastructure/bern-time";
import type { DesktopApp } from "./desktop-apps";
import { DesktopWindow } from "./desktop-window";
import { Dock } from "./dock";
import type { DesktopController } from "./use-desktop";
import { topWindow } from "./window-manager";

const keyboardStep = 16;

const arrowSteps: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-keyboardStep, 0],
  ArrowRight: [keyboardStep, 0],
  ArrowUp: [0, -keyboardStep],
  ArrowDown: [0, keyboardStep],
};

type DesktopSurfaceProps = {
  apps: readonly DesktopApp[];
  controller: DesktopController;
  now: Date | null;
  /** Leaves the computer; Escape with no window open does the same. */
  onLeave?: () => void;
};

// Escape closes the front window and puts focus back on its dock button; F6 and Shift+F6 cycle
// through the open windows; Alt+arrows move the front window.
export function DesktopSurface({ apps, controller, now, onLeave }: DesktopSurfaceProps) {
  const area = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const { windows, setBounds } = controller;
  const front = topWindow(windows);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    // An area not laid out yet measures 0 × 0; placing windows against that would pile them at 0, 0.
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width > 0 && height > 0) setBounds({ width, height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [setBounds]);

  function closeAndReturn(appId: string) {
    controller.close(appId);
    dock.current?.querySelector<HTMLElement>(`[data-dock-app="${appId}"]`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (front) closeAndReturn(front.appId);
      else onLeave?.();
    }
    if (event.key === "F6") {
      event.preventDefault();
      controller.cycle(event.shiftKey ? -1 : 1);
    }
    const step = arrowSteps[event.key];
    if (event.altKey && step && front) {
      event.preventDefault();
      controller.move(front.appId, ...step);
    }
  }

  return (
    // The keyboard handler listens for keys bubbling up from the windows and the dock inside.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onKeyDown={onKeyDown}
      className="from-sky-top to-sky-bottom text-ink flex h-full flex-col bg-linear-to-b"
    >
      <header className="bg-panel/80 flex items-center gap-3 px-4 py-2 backdrop-blur">
        <p className="flex-1 font-extrabold">Office computer</p>
        {now && <p className="text-muted font-bold tabular-nums">{formatBernTime(now)}</p>}
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="bg-panel rounded-pill shadow-panel px-4 py-1.5 font-bold"
          >
            Leave the desk
          </button>
        )}
      </header>
      <div ref={area} className="relative min-h-0 flex-1 overflow-hidden">
        {windows.length === 0 && (
          <p className="text-muted absolute inset-x-4 top-1/3 text-center text-lg font-bold">
            Open an app from the dock.
          </p>
        )}
        {windows.map((place, layer) => {
          const app = apps.find((candidate) => candidate.id === place.appId);
          if (!app) return null;
          return (
            <DesktopWindow
              key={app.id}
              app={app}
              place={place}
              layer={layer + 1}
              focused={place === front}
              focusRequest={controller.focusRequest}
              onFocus={() => controller.focus(app.id)}
              onClose={() => closeAndReturn(app.id)}
              onMove={(dx, dy) => controller.move(app.id, dx, dy)}
            />
          );
        })}
      </div>
      <div ref={dock} className="px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Dock apps={apps} openIds={windows.map((place) => place.appId)} onOpen={controller.open} />
      </div>
    </div>
  );
}

type DesktopDialogProps = DesktopSurfaceProps & { open: boolean; onClose: () => void };

// A native modal dialog like the phone: the world behind is inert, and focus goes back to
// whatever opened the computer.
export function DesktopDialog({ open, onClose, ...surface }: DesktopDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);

  function handleClose() {
    onClose();
    opener.current?.focus();
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Office computer"
      onClose={handleClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/40"
    >
      {open && <DesktopSurface {...surface} onLeave={() => dialog.current?.close()} />}
    </dialog>
  );
}
