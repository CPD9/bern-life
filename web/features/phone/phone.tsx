"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { PhoneHome } from "./phone-home";

export type PhoneApp = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly tile: string;
  readonly content: ReactNode;
};

type PhoneProps = {
  open: boolean;
  onClose: () => void;
  apps: readonly PhoneApp[];
  /** The open app, null for the home screen. Owned by the caller so it can open an app directly. */
  appId: string | null;
  onAppChange: (appId: string | null) => void;
  now: Date | null;
};

// A native modal dialog: the page behind it is inert and Escape closes it. Focus goes back to
// whatever opened the phone (the Phone tab) explicitly, rather than trusting each browser to.
export function Phone({ open, onClose, apps, appId, onAppChange, now }: PhoneProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const app = apps.find((candidate) => candidate.id === appId);

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
    onAppChange(null);
    onClose();
    opener.current?.focus();
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Phone"
      onClose={handleClose}
      className="text-ink m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:h-[min(860px,94dvh)] sm:w-[400px]"
    >
      <div className="flex h-full flex-col gap-3 sm:py-2">
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="bg-panel rounded-pill shadow-panel absolute top-3 right-3 z-10 px-4 py-2 font-bold sm:static sm:self-end"
        >
          <span aria-hidden="true">✕ </span>Close
        </button>
        <div className="bg-panel flex min-h-0 flex-1 flex-col overflow-hidden sm:rounded-[2.75rem] sm:border-8 sm:border-device">
          {app ? (
            <section aria-label={app.label} className="flex min-h-0 flex-1 flex-col">
              <header className="border-panel-border flex items-center gap-2 border-b px-3 py-3 pr-28 sm:pr-3">
                <button
                  type="button"
                  onClick={() => onAppChange(null)}
                  className="rounded-pill text-primary px-3 py-1.5 font-bold"
                >
                  <span aria-hidden="true">‹ </span>Apps
                </button>
                <h2 className="text-lg font-extrabold">{app.label}</h2>
              </header>
              <div className="flex-1 overflow-y-auto px-4 py-4">{app.content}</div>
            </section>
          ) : (
            <PhoneHome now={now} apps={apps} onOpen={onAppChange} />
          )}
        </div>
      </div>
    </dialog>
  );
}
