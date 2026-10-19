"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { IconButton } from "./button";
import { keepTabInside } from "./focus-trap";

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

// A modal sheet that rises from the bottom of whatever positioned box holds it (the phone, a
// window). Mounted means open. Focus moves to the heading, Tab stays inside, Escape closes, and
// focus goes back to what was focused before it opened.
export function Sheet({ title, onClose, children }: SheetProps) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus();
    return () => before?.focus();
  }, []);

  // A native listener, so Escape here is handled before a dialog the sheet sits in sees it.
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const container = element;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      keepTabInside(event, container);
    }
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/40">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-panel text-ink rounded-t-panel shadow-panel flex max-h-[85%] min-h-0 flex-col"
      >
        <header className="border-panel-border flex items-center gap-2 border-b py-2 pr-2 pl-5">
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="flex-1 text-lg font-extrabold outline-none"
          >
            {title}
          </h2>
          <IconButton label="Close" icon="✕" onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
