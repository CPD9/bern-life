"use client";

import { useCallback, useEffect, useRef } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";

/**
 * Reports `office_ready` once the player has onboarded: the first time the office shows, and each
 * time they sit down at the desk. Before onboarding neither counts, since Home is open to anyone.
 * Returns the handler for the desk. The host calls this after `useStory`, so the story is already
 * listening when the first event goes out.
 */
export function useOfficeReady(
  officeShown: boolean,
  onboarded: boolean,
  events: AppEventSink = appEvents,
): () => void {
  const reported = useRef(false);

  useEffect(() => {
    if (!onboarded || !officeShown || reported.current) return;
    reported.current = true;
    events.emit("office_ready");
  }, [officeShown, onboarded, events]);

  return useCallback(() => {
    if (onboarded) events.emit("office_ready");
  }, [onboarded, events]);
}
