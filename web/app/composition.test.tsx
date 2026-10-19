import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { type ReactElement, isValidElement } from "react";
import { AgentsApp } from "@/features/agents/agents-app";
import { useDesktop } from "@/features/desktop/use-desktop";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { useOfficeApps } from "./office-apps";
import { phoneApps } from "./phone-apps";

const offline: NavigatorApi = {
  search: async () => ({ ok: false, failure: { kind: "network" } }),
  brief: async () => ({ ok: false, failure: { kind: "network" } }),
};
const agents = {
  navigatorApi: offline,
  agentName: "Lumi",
  snapshot: null,
  notify: () => undefined,
};

function typeOf(content: unknown): unknown {
  return isValidElement(content) ? (content as ReactElement).type : null;
}

describe("phone apps", () => {
  function setUp() {
    const opened: string[] = [];
    const { result } = renderHook(() => {
      const navigator = useNavigator(offline);
      const apps = phoneApps({
        ...agents,
        navigator,
        fixtureMode: true,
        onShowOnMap: () => undefined,
        onOpenApp: (id) => opened.push(id),
      });
      return { navigator, apps };
    });
    return { result, opened };
  }

  test("every app is real: Messages and Agents are the desk's apps, and nothing is coming next", () => {
    const { apps } = setUp().result.current;
    expect(apps.map((app) => app.label)).toEqual(["Ask", "Messages", "Agents", "Settings"]);
    const byId = Object.fromEntries(apps.map((app) => [app.id, typeOf(app.content)]));
    expect(byId["messages"]).toBe(StandaloneMessagesPage);
    expect(byId["agents"]).toBe(AgentsApp);
  });

  test("Try on a skill opens Ask in the phone, in brief mode for a brief", () => {
    const { result, opened } = setUp();
    const agentsContent = result.current.apps.find((app) => app.id === "agents")!.content;
    render(<>{agentsContent}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try Read a project brief" })));
    expect(opened).toEqual(["ask"]);
    expect(result.current.navigator.inputMode).toBe("brief");
  });
});

describe("office apps", () => {
  test("the desk lists only wired apps, with the unread count on Messages", () => {
    const { result } = renderHook(() =>
      useOfficeApps({
        ...agents,
        navigator: useNavigator(offline),
        desktop: useDesktop(),
        fixtureMode: true,
        unreadMessages: 4,
      }),
    );
    expect(result.current.map((app) => [app.id, app.badge ?? null])).toEqual([
      ["navigator", null],
      ["agents", null],
      ["reports", null],
      ["messages", 4],
      ["settings", null],
    ]);
  });
});
