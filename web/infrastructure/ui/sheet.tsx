"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { IconButton } from "./button";
import { useEscapeLayer } from "./escape-layers";
import { keepTabInside } from "./focus-trap";

type SheetProps = {
  title: string;
  onClose: () => void;
  /** A text action at the right of the title, before Close ("Mark all read", say). */
  actions?: ReactNode | undefined;
  /** The small bar at the top that says the sheet can be dismissed, as iOS sheets have. */
  grabber?: boolean;
  children: ReactNode;
};

// A modal sheet that rises from the bottom of whatever positioned box holds it (the phone, a
// window). Mounted means open. Focus moves to the heading, Tab stays inside, Escape closes, and
// focus goes back to what was focused before it opened.
export function Sheet({ title, onClose, actions, grabber = false, children }: SheetProps) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus();
    return () => before?.focus();
  }, []);

  // Escape closes the sheet as the topmost layer, even with focus on <body>.
  useEscapeLayer(true, onClose);

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const container = element;
    const onKeyDown = (event: KeyboardEvent) => keepTabInside(event, container);
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/40">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-panel text-ink rounded-t-panel shadow-panel flex max-h-[85%] min-h-0 flex-col"
      >
        {grabber && (
          <div aria-hidden="true" className="flex justify-center pt-2">
            <span className="bg-muted/40 block h-1.5 w-9 rounded-full" />
          </div>
        )}
        <header
          className={`flex items-center gap-2 py-2 pr-2 ${grabber ? "pl-4" : "border-panel-border border-b pl-5"}`}
        >
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className={`flex-1 outline-none ${grabber ? "text-base font-semibold" : "text-lg font-extrabold"}`}
          >
            {title}
          </h2>
          {actions}
          <IconButton
            label="Close"
            icon="✕"
            onClick={onClose}
            className={grabber ? "size-11" : ""}
          />
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto py-4 ${grabber ? "px-4" : "px-5"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
