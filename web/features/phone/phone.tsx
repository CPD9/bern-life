"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { useEscapeLayer } from "@/infrastructure/ui/escape-layers";
import { focusOnOpen } from "@/infrastructure/ui/focus-on-open";
import { WindowChrome, belowPhoneHeader } from "@/infrastructure/ui/window-chrome";
import { NotificationCentre } from "./notification-centre";
import { PhoneHome } from "./phone-home";
import { PhoneStatusBar } from "./phone-status-bar";
import type { PhoneApp, PhoneHealth, PhoneNotification } from "./phone-types";
import { useBackStack } from "./use-back-stack";

export type { PhoneApp, PhoneHealth, PhoneNotification } from "./phone-types";

type PhoneProps = {
  open: boolean;
  onClose: () => void;
  apps: readonly PhoneApp[];
  /** The open app, null for the home screen. Owned by the caller so it can open an app directly. */
  appId: string | null;
  onAppChange: (appId: string | null) => void;
  now: Date | null;
  /** The engine chip in the status bar; none while unknown. */
  health?: PhoneHealth | undefined;
  /** A dot in the status bar; none for 0 or when unknown. */
  unreadMessages?: number | undefined;
  /** Turns on the notification centre; its unread ones put a dot on the bell. */
  notifications?: readonly PhoneNotification[] | undefined;
  /** Called after the notification centre has closed, so the app it opens is what shows. */
  onOpenNotification?: ((notification: PhoneNotification) => void) | undefined;
  onMarkAllRead?: (() => void) | undefined;
  /**
   * Shown inside the phone's dialog (the top layer): toasts, say. It starts below the status bar,
   * and in an app below the app's header too, so it never covers Close, the bell, Back or the title.
   * With the notification centre open over an app it starts below the status bar only.
   */
  overlay?: ReactNode;
};

// A native modal dialog: the page behind it is inert and Escape closes it from the home screen.
// Inside an app, Back and Escape return to the app before or home. Whenever the app changes,
// focus moves into the new app (the field it marks, else its title), or home to the tile of the
// app just left, so it never falls to <body>. Focus goes back to whatever opened the phone (the
// Phone tab) on close.
export function Phone({
  open,
  onClose,
  apps,
  appId,
  onAppChange,
  now,
  health,
  unreadMessages,
  notifications,
  onOpenNotification,
  onMarkAllRead,
  overlay,
}: PhoneProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const frame = useRef<HTMLElement>(null);
  const shownApp = useRef<string | null>(appId);
  const headingId = useId();
  const [centreOpen, setCentreOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const history = useBackStack(appId, onAppChange);
  const app = apps.find((candidate) => candidate.id === appId);
  const unread = notifications?.filter((notification) => !notification.read).length;

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

  useEffect(() => {
    const left = shownApp.current;
    shownApp.current = appId;
    const element = dialog.current;
    if (left === appId || !element?.open) return;
    if (appId !== null) {
      focusOnOpen(frame.current, heading.current);
      return;
    }
    const tile =
      (left === null
        ? null
        : element.querySelector<HTMLElement>(`[data-app-tile="${CSS.escape(left)}"]`)) ??
      element.querySelector<HTMLElement>("[data-app-tile]");
    tile?.focus({ preventScroll: true });
  }, [appId]);

  // Escape inside an app goes back instead of closing the phone, wherever focus is. A sheet
  // opened on top (the notification centre) is a higher layer and closes first.
  useEscapeLayer(open && appId !== null, () => {
    if (centreOpen) setCentreOpen(false);
    else history.back();
  });

  function handleClose() {
    history.clear();
    setCentreOpen(false);
    onAppChange(null);
    onClose();
    opener.current?.focus();
  }

  const openNotification = onOpenNotification
    ? (notification: PhoneNotification) => {
        setCentreOpen(false);
        onOpenNotification(notification);
      }
    : undefined;
  const push = reducedMotion ? "" : "motion-safe:animate-phone-push";
  const fade = reducedMotion ? "" : "motion-safe:animate-phone-in";
  const backTitle =
    history.previous === null
      ? "Home"
      : (apps.find((candidate) => candidate.id === history.previous)?.label ?? "Back");

  return (
    <dialog
      ref={dialog}
      aria-label="Phone"
      onClose={handleClose}
      className="text-ink m-0 h-dvh max-h-none w-screen max-w-none overflow-clip bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:h-[min(860px,94dvh)] sm:w-[400px]"
    >
      {/* Clipped, not hidden: a hidden-overflow box can still be scrolled by focus() or by the
          browser's own dialog scrolling, which carried the status bar and title bar out of view
          until Escape re-rendered the phone. A clipped box cannot scroll. */}
      <div className="bg-panel sm:border-device relative flex h-full flex-col overflow-clip sm:rounded-[2.75rem] sm:border-8">
        <PhoneStatusBar
          now={now}
          health={health}
          unreadMessages={unreadMessages}
          unreadNotifications={unread}
          onOpenNotifications={notifications ? () => setCentreOpen(true) : undefined}
          onClose={() => dialog.current?.close()}
        />
        <div className="relative flex min-h-0 flex-1 flex-col">
          {app ? (
            <section
              key={app.id}
              ref={frame}
              aria-labelledby={headingId}
              className={`flex min-h-0 flex-1 flex-col ${push}`}
            >
              <WindowChrome
                title={app.label}
                headingId={headingId}
                headingRef={heading}
                onBack={history.back}
                backLabel={backTitle}
                variant="phone"
              >
                {app.content}
              </WindowChrome>
            </section>
          ) : (
            <div key="home" className={`flex min-h-0 flex-1 flex-col ${fade}`}>
              <PhoneHome now={now} apps={apps} onOpen={onAppChange} />
            </div>
          )}
          {centreOpen && notifications && (
            <NotificationCentre
              notifications={notifications}
              now={now}
              onClose={() => setCentreOpen(false)}
              onOpen={openNotification}
              onMarkAllRead={onMarkAllRead}
            />
          )}
          {overlay !== undefined && (
            // Below the status bar (this box's parent starts there) and, while an app's header is
            // showing, below it too; the notification centre covers that header, so not then.
            // contain:layout makes it the frame for fixed-position children (toasts).
            <div
              data-phone-overlay
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 [contain:layout] ${
                app && !centreOpen ? belowPhoneHeader : "top-0"
              }`}
            >
              {overlay}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
