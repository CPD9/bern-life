"use client";

import { connectLive } from "./live-client";
import { httpMessagesApi } from "./messages-api";
import { type StartWith, StandaloneMessages } from "./messages-app";

type PageProps = { startWith?: StartWith | undefined; onStarted?: (() => void) | undefined };

export function StandaloneMessagesPage({ startWith, onStarted }: PageProps) {
  return (
    <StandaloneMessages
      api={httpMessagesApi}
      connect={connectLive}
      startWith={startWith}
      onStarted={onStarted}
    />
  );
}
