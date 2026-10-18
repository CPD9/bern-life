"use client";

import { connectLive } from "./live-client";
import { httpMessagesApi } from "./messages-api";
import { StandaloneMessages } from "./messages-app";

export function StandaloneMessagesPage() {
  return <StandaloneMessages api={httpMessagesApi} connect={connectLive} />;
}
