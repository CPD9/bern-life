import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { type ReactElement, isValidElement } from "react";
import { AgentsApp } from "@/features/agents/agents-app";
import { useDesktop } from "@/features/desktop/use-desktop";
import { GarageApp } from "@/features/garage/garage-app";
import { LibraryApp } from "@/features/library/library-app";
import { browserLibrary } from "@/features/library/library-store";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { OpportunitiesApp } from "@/features/opportunities/opportunities-app";
import { SettingsApp } from "@/features/phone/settings-app";
import { SourcesApp } from "@/features/sources/sources-app";
import type { AppEventName } from "@/infrastructure/app-events";
import type { SearchResult } from "@/infrastructure/claims";
import { healthFixture, resultFixture } from "@/test/fixtures";
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

const health = { status: "ok", health: healthFixture } as const;
const heard: AppEventName[] = [];
const events = { emit: (name: AppEventName) => void heard.push(name) };

beforeEach(() => {
  heard.length = 0;
  for (const item of browserLibrary().get()) browserLibrary().remove(item);
});

type SaveSlot = { renderSave: (result: SearchResult) => ReactElement };

/** Saves the fixture's first person through a Navigator's save slot. */
function saveFrom(navigator: unknown) {
  const { renderSave } = (navigator as ReactElement<SaveSlot>).props;
  render(renderSave(resultFixture.results[0]!));
  act(() => fireEvent.click(screen.getByRole("button", { name: /^Save to library/ })));
}

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
        unreadMessages: 2,
        health,
        events,
      });
      return { navigator, apps };
    });
    return { result, opened };
  }

  test("every app is real: the desk's apps, and nothing is coming next", () => {
    const { apps } = setUp().result.current;
    expect(apps.map((app) => app.label)).toEqual([
      "Ask",
      "Messages",
      "Agents",
      "Opportunities",
      "Library",
      "Settings",
    ]);
    const byId = Object.fromEntries(apps.map((app) => [app.id, typeOf(app.content)]));
    expect(byId["messages"]).toBe(StandaloneMessagesPage);
    expect(byId["agents"]).toBe(AgentsApp);
    expect(byId["opportunities"]).toBe(OpportunitiesApp);
    expect(byId["library"]).toBe(LibraryApp);
    expect(byId["settings"]).toBe(SettingsApp);
  });

  test("Messages carries the unread count, and Settings the engine's health", () => {
    const { apps } = setUp().result.current;
    expect(apps.map((app) => app.badge ?? null)).toEqual([null, 2, null, null, null, null]);
    const settings = apps.find((app) => app.id === "settings")!.content as ReactElement<{
      health: unknown;
    }>;
    expect(settings.props.health).toBe(health);
  });

  test("a person saved from Ask is kept in the Library, and counts once", () => {
    saveFrom(setUp().result.current.apps.find((app) => app.id === "ask")!.content);
    expect(heard).toEqual(["library_item_saved"]);
  });

  test("Try on Find opportunities opens the Opportunities app", () => {
    const { result, opened } = setUp();
    const agentsContent = result.current.apps.find((app) => app.id === "agents")!.content;
    render(<>{agentsContent}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try Find opportunities" })));
    expect(opened).toEqual(["opportunities"]);
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
  function setUp() {
    return renderHook(() => {
      const desktop = useDesktop();
      const apps = useOfficeApps({
        ...agents,
        navigator: useNavigator(offline),
        desktop,
        fixtureMode: true,
        unreadMessages: 4,
        health,
        events,
      });
      return { desktop, apps };
    }).result;
  }

  test("the desk lists every app, each real, with the unread count on Messages", () => {
    const { apps } = setUp().current;
    expect(apps.map((app) => [app.id, app.badge ?? null])).toEqual([
      ["navigator", null],
      ["agents", null],
      ["reports", null],
      ["messages", 4],
      ["library", null],
      ["opportunities", null],
      ["garage", null],
      ["sources", null],
      ["settings", null],
    ]);
    const byId = Object.fromEntries(apps.map((app) => [app.id, typeOf(app.content)]));
    expect([byId["garage"], byId["sources"], byId["settings"]]).toEqual([
      GarageApp,
      SourcesApp,
      SettingsApp,
    ]);
    const settings = apps.find((app) => app.id === "settings")!.content as ReactElement<{
      health: unknown;
    }>;
    expect(settings.props.health).toBe(health);
  });

  test("a person saved from the Navigator is kept in the Library, and counts once", () => {
    saveFrom(setUp().current.apps.find((app) => app.id === "navigator")!.content);
    expect(heard).toEqual(["library_item_saved"]);
  });

  test("Try on Find opportunities opens the Opportunities window", () => {
    const result = setUp();
    render(<>{result.current.apps.find((app) => app.id === "agents")!.content}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try Find opportunities" })));
    expect(result.current.desktop.windows.map((place) => place.appId)).toEqual(["opportunities"]);
  });
});
