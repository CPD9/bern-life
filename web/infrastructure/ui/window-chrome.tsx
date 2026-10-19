import type { ReactNode, Ref } from "react";
import { IconButton } from "./button";

/** The header is exactly h-14; a layer that must not cover it starts here. */
export const belowWindowHeader = "top-14";

type WindowChromeProps = {
  title: string;
  headingId: string;
  /** Focus target when the window opens or comes back to the front. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Shows a back button before the title. */
  onBack?: (() => void) | undefined;
  backLabel?: string;
  /** Shows a close button after the title. */
  onClose?: (() => void) | undefined;
  closeLabel?: string | undefined;
  /** Extra controls between the title and the close button. */
  actions?: ReactNode | undefined;
  children: ReactNode;
};

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
  children,
}: WindowChromeProps) {
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
