import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { type ReactElement, isValidElement } from "react";
import { AgentsApp } from "@/features/agents/agents-app";
import { useDesktop } from "@/features/desktop/use-desktop";
import { GarageApp } from "@/features/garage/garage-app";
import { LibraryApp } from "@/features/library/library-app";
import { type LibraryStore, createLibraryStore } from "@/features/library/library-store";
import { memoryStorage } from "@/features/library/testing";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { OpportunitiesApp } from "@/features/opportunities/opportunities-app";
import { SettingsApp } from "@/features/phone/settings-app";
import { SourcesApp } from "@/features/sources/sources-app";
import type { AppEventName } from "@/infrastructure/app-events";
import type { SearchResult } from "@/infrastructure/claims";
import { parseNumbers } from "@/infrastructure/numbers";
import type { NumbersApi } from "@/infrastructure/numbers-api";
import { healthFixture, resultFixture } from "@/test/fixtures";
import { numbersBody, queuedApi } from "@/test/numbers";
import { useOfficeApps } from "./office-apps";
import { phoneApps } from "./phone-apps";

const offline: NavigatorApi = {
  search: async () => ({ ok: false, failure: { kind: "network" } }),
  brief: async () => ({ ok: false, failure: { kind: "network" } }),
};
/** Numbers that never arrive: the skills wait on "Loading" and nothing is fetched. */
const pending: NumbersApi = { numbers: () => new Promise(() => undefined) };
const agents = {
  navigatorApi: offline,
  agentName: "Bärnli",
  snapshot: null,
  notify: () => undefined,
};
const engineNumbers = () => queuedApi([{ status: "ok", numbers: parseNumbers(numbersBody())! }]);

/** The value cell of a skill's first evidence row. */
function firstValue(skill: string): string | null | undefined {
  return screen.getByLabelText(`Evidence: ${skill}`).querySelector("dd")?.textContent;
}

const health = { status: "ok", health: healthFixture } as const;
const heard: AppEventName[] = [];
const events = { emit: (name: AppEventName) => void heard.push(name) };
let library: LibraryStore;
const person = resultFixture.results[0]!;

beforeEach(() => {
  heard.length = 0;
  library = createLibraryStore(() => memoryStorage());
});

type SaveSlot = { renderSave?: (result: SearchResult) => ReactElement };

function saveSlotOf(content: unknown): SaveSlot["renderSave"] {
  return (content as ReactElement<SaveSlot>).props.renderSave;
}

/** Saves the fixture's first person through a Navigator's save slot. */
function saveFrom(navigator: unknown) {
  render(saveSlotOf(navigator)!(person));
  act(() => fireEvent.click(screen.getByRole("button", { name: /^Save to library/ })));
}

function typeOf(content: unknown): unknown {
  return isValidElement(content) ? (content as ReactElement).type : null;
}

describe("phone apps", () => {
  function setUp(fixtureMode = false, numbersApi: NumbersApi = pending) {
    const opened: string[] = [];
    const { result } = renderHook(() => {
      const navigator = useNavigator(offline);
      const apps = phoneApps({
        ...agents,
        numbersApi,
        navigator,
        fixtureMode,
        onShowOnMap: () => undefined,
        onOpenApp: (id) => opened.push(id),
        unreadMessages: 2,
        health,
        events,
        library,
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
    const { apps } = setUp().result.current;
    saveFrom(apps.find((app) => app.id === "ask")!.content);
    expect(library.get().map((item) => [item.kind, item.ref])).toEqual([
      ["profile", person.profile.id],
    ]);
    expect(heard).toEqual(["library_item_saved"]);
    const shelf = apps.find((app) => app.id === "library")!.content as ReactElement<{
      store: unknown;
    }>;
    expect(shelf.props.store).toBe(library);
  });

  test("in fixture mode nothing invented can be saved: no save button in Ask or Opportunities", () => {
    const { apps } = setUp(true).result.current;
    for (const id of ["ask", "opportunities"]) {
      expect(saveSlotOf(apps.find((app) => app.id === id)!.content)).toBeUndefined();
    }
  });

  test("Connections sits after Messages when composed, and Messages opens the asked thread", () => {
    const messageWith = { handle: "bea", key: 3 };
    const started = () => undefined;
    const { result } = renderHook(() =>
      phoneApps({
        ...agents,
        navigator: useNavigator(offline),
        fixtureMode: false,
        onShowOnMap: () => undefined,
        onOpenApp: () => undefined,
        connections: <p>members</p>,
        messageWith,
        onMessageStarted: started,
      }),
    );
    expect(result.current.map((app) => app.id).slice(0, 3)).toEqual([
      "ask",
      "messages",
      "connections",
    ]);
    const messages = result.current[1]!.content as ReactElement<{
      startWith: unknown;
      onStarted: unknown;
    }>;
    expect([messages.props.startWith, messages.props.onStarted]).toEqual([messageWith, started]);
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

  test("Try on Checks the premise opens Ask in search mode, even after a brief", () => {
    const { result, opened } = setUp();
    act(() => result.current.navigator.setInputMode("brief"));
    render(<>{result.current.apps.find((app) => app.id === "agents")!.content}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try Checks the premise" })));
    expect(opened).toEqual(["ask"]);
    expect(result.current.navigator.inputMode).toBe("search");
  });

  test("the skills' numbers are marked FIXTURE only when the engine serves fixtures", async () => {
    for (const [fixtureMode, value] of [
      [false, "7 / 10"],
      [true, "FIXTURE 7 / 10"],
    ] as const) {
      const { result } = setUp(fixtureMode, engineNumbers());
      const view = await act(async () =>
        render(<>{result.current.apps.find((app) => app.id === "agents")!.content}</>),
      );
      expect(firstValue("Checks the premise")).toBe(value);
      view.unmount();
    }
  });
});

describe("office apps", () => {
  function setUp(fixtureMode = false, numbersApi: NumbersApi = pending) {
    return renderHook(() => {
      const desktop = useDesktop();
      const navigator = useNavigator(offline);
      const { apps } = useOfficeApps({
        ...agents,
        numbersApi,
        navigator,
        desktop,
        fixtureMode,
        unreadMessages: 4,
        health,
        events,
        library,
      });
      return { desktop, navigator, apps };
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
    expect(library.get().map((item) => item.ref)).toEqual([person.profile.id]);
    expect(heard).toEqual(["library_item_saved"]);
  });

  test("in fixture mode the Navigator and Opportunities have no save button", () => {
    const { apps } = setUp(true).current;
    for (const id of ["navigator", "opportunities"]) {
      expect(saveSlotOf(apps.find((app) => app.id === id)!.content)).toBeUndefined();
    }
  });

  test("Try on Find opportunities opens the Opportunities window", () => {
    const result = setUp();
    render(<>{result.current.apps.find((app) => app.id === "agents")!.content}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try Find opportunities" })));
    expect(result.current.desktop.windows.map((place) => place.appId)).toEqual(["opportunities"]);
  });

  test("Try on Checks the premise opens the Navigator in search mode", () => {
    const result = setUp();
    act(() => result.current.navigator.setInputMode("brief"));
    render(<>{result.current.apps.find((app) => app.id === "agents")!.content}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Try Checks the premise" })));
    expect(result.current.desktop.windows.map((place) => place.appId)).toEqual(["navigator"]);
    expect(result.current.navigator.inputMode).toBe("search");
  });

  test("the Garage lists each skill with its evidence, read-only, from its one numbers call", async () => {
    const numbersApi = engineNumbers();
    const result = setUp(false, numbersApi);
    await act(async () =>
      render(<>{result.current.apps.find((app) => app.id === "garage")!.content}</>),
    );
    const section = screen.getByRole("region", { name: "Skills" });
    expect(
      within(section)
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Search people and units",
      "Checks the premise",
      "Read a project brief",
      "Make a match report",
      "Find opportunities",
    ]);
    expect(within(section).queryAllByRole("button")).toEqual([]);
    expect(firstValue("Checks the premise")).toBe("7 / 10");
    expect(firstValue("Search people and units")).toBe("0.4375 [0.29, 0.58]");
    expect(
      within(section).getByText(/models are set on the server, as endpoints in its settings/),
    ).toBeTruthy();
    expect(numbersApi.calls()).toBe(1);
  });

  test("in fixture mode the Garage's skills are marked FIXTURE and nothing is called measured", async () => {
    const result = setUp(true, engineNumbers());
    await act(async () =>
      render(<>{result.current.apps.find((app) => app.id === "garage")!.content}</>),
    );
    expect(firstValue("Checks the premise")).toBe("FIXTURE 7 / 10");
    expect(document.body.textContent).not.toMatch(/measured/i);
  });
});
