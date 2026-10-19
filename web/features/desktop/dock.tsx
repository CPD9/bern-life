"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { AppIcon } from "@/infrastructure/ui/app-icons";
import type { DesktopApp } from "./desktop-apps";

type DockProps = {
  apps: readonly DesktopApp[];
  openIds: readonly string[];
  onOpen: (appId: string) => void;
};

// A floating tray like the Mac dock: 56 pt icons, the label as a tooltip above on hover or focus,
// a dot under each open app. One tab stop for the whole dock; arrows, Home and End move between
// apps (WAI-ARIA toolbar).
export function Dock({ apps, openIds, onOpen }: DockProps) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function moveTo(index: number) {
    const next = (index + apps.length) % apps.length;
    setActive(next);
    buttons.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const targets: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: apps.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveTo(target);
  }

  return (
    <div
      role="toolbar"
      aria-label="Apps"
      onKeyDown={onKeyDown}
      className="bg-panel/70 border-panel-border shadow-panel mx-auto flex w-fit max-w-full flex-wrap justify-center gap-2 rounded-2xl border p-2 backdrop-blur sm:flex-nowrap"
    >
      {apps.map((app, index) => {
        const isOpen = openIds.includes(app.id);
        return (
          <button
            key={app.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            data-dock-app={app.id}
            tabIndex={index === active ? 0 : -1}
            onFocus={() => setActive(index)}
            onClick={() => onOpen(app.id)}
            className="group relative flex flex-col items-center gap-1 rounded-xl"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: app.tile }}
              className="shadow-panel relative flex size-14 origin-bottom items-center justify-center rounded-xl text-white motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:scale-[1.08]"
            >
              <AppIcon app={app.icon} />
              {app.badge !== undefined && (
                <span className="bg-alert rounded-pill absolute -top-1 -right-1 min-w-5 px-1.5 text-xs leading-5 font-bold text-white">
                  {app.badge > 9 ? "9+" : app.badge}
                </span>
              )}
            </span>
            <span className="bg-panel shadow-panel border-panel-border pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border px-2 py-1 text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
              {app.label}
            </span>
            {app.badge !== undefined && <span className="sr-only">, {app.badge} unread</span>}
            <span
              aria-hidden="true"
              className={`size-1 rounded-full ${isOpen ? "bg-ink" : "bg-transparent"}`}
            />
            {isOpen && <span className="sr-only">, open</span>}
          </button>
        );
      })}
    </div>
  );
}
