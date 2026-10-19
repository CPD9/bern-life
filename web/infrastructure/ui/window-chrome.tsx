"use client";

import { type ReactNode, type Ref, useState } from "react";
import { IconButton } from "./button";

/** The desktop header is exactly h-14; a layer that must not cover it starts here. */
export const belowWindowHeader = "top-14";
/** The phone's navigation bar is exactly h-11 (44 pt); a layer that must not cover it starts here. */
export const belowPhoneHeader = "top-11";

type WindowChromeProps = {
  title: string;
  headingId: string;
  /** Focus target when the window opens or comes back to the front. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Shows a back button before the title. */
  onBack?: (() => void) | undefined;
  /**
   * The desktop's back button is named this. The phone shows it beside the chevron as the title
   * of where Back leads ("Home", or the app before), and names the button "Back to <it>".
   */
  backLabel?: string;
  /** Shows a close button after the title. */
  onClose?: (() => void) | undefined;
  closeLabel?: string | undefined;
  /** Extra controls between the title and the close button. */
  actions?: ReactNode | undefined;
  /** The phone's 44 pt navigation bar: translucent, centred title, chevron plus destination. */
  variant?: "window" | "phone";
  children: ReactNode;
};

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

// The title bar and scrolling body every app window shares, in the phone and on the desktop. The
// caller labels its region with headingId.
export function WindowChrome({
  title,
  headingId,
  headingRef,
  onBack,
  backLabel = "Back",
  onClose,
  closeLabel,
  actions,
  variant = "window",
  children,
}: WindowChromeProps) {
  const [scrolled, setScrolled] = useState(false);
  if (variant === "phone") {
    return (
      <>
        <header
          className={`bg-panel/80 relative z-10 grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2 backdrop-blur-md ${
            scrolled ? "border-panel-border border-b" : ""
          }`}
        >
          <div className="flex min-w-0 justify-start">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label={`Back to ${backLabel}`}
                className="text-primary rounded-pill focus-visible:outline-focus flex h-11 min-w-11 max-w-full items-center pr-2 pl-1 text-[17px] focus-visible:outline-3"
              >
                <Chevron />
                <span className="truncate">{backLabel}</span>
              </button>
            )}
          </div>
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="min-w-0 truncate px-2 text-center text-[17px] font-semibold outline-none"
          >
            {title}
          </h2>
          <div className="flex min-w-0 justify-end">
            {actions}
            {onClose && (
              <IconButton
                label={closeLabel ?? `Close ${title}`}
                icon="✕"
                onClick={onClose}
                className="size-11"
              />
            )}
          </div>
        </header>
        <div
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          {children}
        </div>
      </>
    );
  }
  return (
    <>
      <header className="border-panel-border flex h-14 shrink-0 items-center gap-1 border-b px-2">
        {onBack && <IconButton label={backLabel} icon="‹" onClick={onBack} className="text-2xl" />}
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className={`min-w-0 flex-1 truncate text-lg font-extrabold outline-none ${onBack ? "" : "pl-2"}`}
        >
          {title}
        </h2>
        {actions}
        {onClose && (
          <IconButton label={closeLabel ?? `Close ${title}`} icon="✕" onClick={onClose} />
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </>
  );
}
