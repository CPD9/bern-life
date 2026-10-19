"use client";

import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { useAgentName } from "@/features/avatar/use-person";
import { DesktopSurface } from "@/features/desktop/desktop";
import { useDesktop } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { Toasts } from "@/features/notifications/toasts";
import { notificationStore } from "@/features/notifications/use-notifications";
import { useHealth } from "@/features/shell/use-health";
import { useNow } from "@/infrastructure/bern-time";
import { notifyLoop, useOfficeApps } from "../office-apps";
import { useUnreadMessages } from "../use-unread-messages";

export function OfficeApp({ fixtureMode }: { fixtureMode: boolean }) {
  const navigator = useNavigator(httpNavigatorApi);
  const desktop = useDesktop();
  const [agentName] = useAgentName();
  const health = useHealth();
  const account = useAccount(httpAccountApi);
  // Read again when the Messages window opens or closes, since reading sends no live notice.
  const messagesOpen = desktop.windows.some((place) => place.appId === "messages");
  const unreadMessages = useUnreadMessages(account.state.status === "signed-in", messagesOpen);
  const apps = useOfficeApps({
    navigator,
    navigatorApi: httpNavigatorApi,
    desktop,
    fixtureMode,
    agentName,
    snapshot: health.status === "ok" ? health.health.snapshot : null,
    notify: notifyLoop,
    unreadMessages,
  });
  const now = useNow();
  // A loop's news shows as a toast here too, since this page has no bell.
  return (
    <>
      <DesktopSurface apps={apps} controller={desktop} now={now} />
      <Toasts store={notificationStore()} />
    </>
  );
}
