"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import { ConnectionsApp } from "@/features/connections/connections-app";
import { type ConnectionsApi, httpConnectionsApi } from "@/features/connections/connections-api";
import { connectedPeople } from "@/features/connections/network";
import { type ConnectionsController, useConnections } from "@/features/connections/use-connections";
import type { StartWith } from "@/features/messages/messages-app";
import { notificationStore, useNotifications } from "@/features/notifications/use-notifications";
import { OfficeRoom } from "@/features/office/office-room";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";

// Connections as the app composes them: one controller for the desk, the phone and You's People
// tab; a visited office drawn by the office feature, read-only; and the story told when a
// connection is made, which only an accepted request does.

export type ConnectionsWiring = {
  controller: ConnectionsController;
  api: ConnectionsApi;
  renderRoom: (ownerName: string) => ReactNode;
};

type Input = {
  signedIn: boolean;
  lite: boolean;
  reducedMotion: boolean;
  events?: AppEventSink;
  api?: ConnectionsApi;
};

export function useWorldConnections({
  signedIn,
  lite,
  reducedMotion,
  events = appEvents,
  api = httpConnectionsApi,
}: Input) {
  // A new connection notification (asked, accepted) is when the lists change; read them again.
  const notices = useNotifications(notificationStore());
  const latest = notices.find((notice) => notice.kind === "connection")?.id ?? null;
  const controller = useConnections(api, {
    refreshKey: `${signedIn}:${latest}`,
    onConnected: () => events.emit("connection_saved"),
  });
  const wiring: ConnectionsWiring = {
    controller,
    api,
    renderRoom: (ownerName) => (
      <OfficeRoom visiting={ownerName} lite={lite} reducedMotion={reducedMotion} />
    ),
  };
  return {
    wiring,
    /** Accepted connections for You's People tab; null when signed out. */
    people: controller.signedIn ? connectedPeople(controller.requests) : null,
  };
}

/** The Connections app; "Message" goes to Messages in the same place, phone or desk. */
export function connectionsApp(
  wiring: ConnectionsWiring,
  onMessage: (handle: string) => void,
): ReactNode {
  return (
    <ConnectionsApp
      controller={wiring.controller}
      api={wiring.api}
      onMessage={onMessage}
      renderRoom={wiring.renderRoom}
    />
  );
}

/**
 * The thread "Message" asked Messages to open, until Messages has opened it. Every ask gets its own
 * key, so a Messages window that stays open still sees the second ask for the same handle.
 */
export function useMessageWith() {
  const [messageWith, setMessageWith] = useState<StartWith | undefined>(undefined);
  const asks = useRef(0);
  const ask = useCallback((handle: string) => {
    asks.current += 1;
    setMessageWith({ handle, key: asks.current });
  }, []);
  const started = useCallback(() => setMessageWith(undefined), []);
  return { messageWith, ask, started };
}
