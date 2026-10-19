"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { WindowChrome } from "@/infrastructure/ui/window-chrome";
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
  onOpenNotification?: ((notification: PhoneNotification) => void) | undefined;
  onMarkAllRead?: (() => void) | undefined;
};

type FocusAfter = { kind: "tile"; appId: string } | { kind: "heading" } | null;

// A native modal dialog: the page behind it is inert and Escape closes it from the home screen.
// Inside an app, Back and Escape return to the app before or home, and focus lands on the tile
// that opened it. Focus goes back to whatever opened the phone (the Phone tab) on close.
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
}: PhoneProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<FocusAfter>(null);
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
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === null) return;
    // Back to home lands on the tile that opened the app; anywhere else, on the app's title.
    const tile =
      target.kind === "tile" && appId === null
        ? dialog.current?.querySelector<HTMLElement>(
            `[data-app-tile="${CSS.escape(target.appId)}"]`,
          )
        : null;
    (tile ?? heading.current)?.focus();
  }, [appId]);

  function openApp(id: string) {
    focusAfter.current = { kind: "heading" };
    onAppChange(id);
  }

  function back() {
    focusAfter.current = appId === null ? null : { kind: "tile", appId };
    history.back();
  }

  // Escape inside an app goes back instead of closing the phone. A native listener, so a sheet
  // inside the phone that handles Escape itself stops it first.
  useEffect(() => {
    const element = dialog.current;
    if (!element || appId === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      back();
    }
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  });

  function handleClose() {
    history.clear();
    setCentreOpen(false);
    onAppChange(null);
    onClose();
    opener.current?.focus();
  }

  const transition = reducedMotion ? "" : "motion-safe:animate-phone-in";

  return (
    <dialog
      ref={dialog}
      aria-label="Phone"
      onClose={handleClose}
      className="text-ink m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:h-[min(860px,94dvh)] sm:w-[400px]"
    >
      <div className="bg-panel sm:border-device relative flex h-full flex-col overflow-hidden sm:rounded-[2.75rem] sm:border-8">
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
              aria-labelledby={headingId}
              className={`flex min-h-0 flex-1 flex-col ${transition}`}
            >
              <WindowChrome
                title={app.label}
                headingId={headingId}
                headingRef={heading}
                onBack={back}
              >
                {app.content}
              </WindowChrome>
            </section>
          ) : (
            <div key="home" className={`flex min-h-0 flex-1 flex-col ${transition}`}>
              <PhoneHome now={now} apps={apps} onOpen={openApp} />
            </div>
          )}
          {centreOpen && notifications && (
            <NotificationCentre
              notifications={notifications}
              now={now}
              onClose={() => setCentreOpen(false)}
              onOpen={onOpenNotification}
              onMarkAllRead={onMarkAllRead}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}
