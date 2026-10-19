"use client";

import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { useAgentName } from "@/features/avatar/use-person";
import { DesktopSurface } from "@/features/desktop/desktop";
import { useDesktop } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { Toasts } from "@/features/notifications/toasts";
import { notificationStore, useInboxSync } from "@/features/notifications/use-notifications";
import { useHealth } from "@/features/shell/use-health";
import { useNow } from "@/infrastructure/bern-time";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { useSettings } from "@/infrastructure/use-settings";
import { notifyLoop, useOfficeApps } from "../office-apps";
import { unreadRefresh, useUnreadMessages } from "../use-unread-messages";
import { connectionsApp, useMessageWith, useWorldConnections } from "../world-connections";

export function OfficeApp({ fixtureMode }: { fixtureMode: boolean }) {
  const navigator = useNavigator(httpNavigatorApi);
  const desktop = useDesktop();
  const [agentName] = useAgentName();
  const health = useHealth();
  const account = useAccount(httpAccountApi);
  const signedIn = account.state.status === "signed-in";
  // Read again when the Messages window opens or closes, since reading sends no live notice.
  const unreadMessages = useUnreadMessages(signedIn, unreadRefresh(false, true, desktop.windows));
  useInboxSync(signedIn, unreadMessages);
  const [settings] = useSettings();
  const reducedMotion = useReducedMotion();
  const connections = useWorldConnections({ signedIn, lite: settings.lite, reducedMotion });
  const message = useMessageWith();
  const { apps } = useOfficeApps({
    navigator,
    navigatorApi: httpNavigatorApi,
    desktop,
    fixtureMode,
    agentName,
    snapshot: health.status === "ok" ? health.health.snapshot : null,
    notify: notifyLoop,
    unreadMessages,
    health,
    connections: connectionsApp(connections.wiring, (handle) => {
      message.ask(handle);
      desktop.open("messages");
    }),
    messageWith: message.messageWith,
    onMessageStarted: message.started,
  });
  const now = useNow();
  // A loop's news, a message or a request shows as a toast here too, since this page has no bell.
  return (
    <>
      <DesktopSurface apps={apps} controller={desktop} now={now} />
      <Toasts store={notificationStore()} />
    </>
  );
}
