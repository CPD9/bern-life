"use client";

import { useCallback, useEffect, useRef } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";

/**
 * Reports `office_ready` the first time the office shows after onboarding, and each time the player
 * sits down at the desk; returns the handler for the desk. The host calls this after `useStory`, so
 * the story is already listening when the first event goes out.
 */
export function useOfficeReady(officeShown: boolean, events: AppEventSink = appEvents): () => void {
  const reported = useRef(false);

  useEffect(() => {
    if (!officeShown || reported.current) return;
    reported.current = true;
    events.emit("office_ready");
  }, [officeShown, events]);

  return useCallback(() => events.emit("office_ready"), [events]);
}
