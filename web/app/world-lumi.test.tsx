import { afterEach, expect, mock, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { defaultBear } from "@/features/avatar/bear-config";
import type { AgentReply } from "@/features/lumi/agent-reply";
import type { LumiApi } from "@/features/lumi/lumi-api";
import { held } from "@/features/lumi/test-harness";
import { Phone } from "@/features/phone/phone";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { resultFixture } from "@/test/fixtures";
import { useWorldPhone } from "./world-phone";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { useWorldLumi } = await import("./world-lumi");

const answer = resultFixture;
const profileId = answer.results[0]!.profile.id;

function replyWith(actions: AgentReply["actions"]): AgentReply {
  return {
    reply: "Demo reply.",
    mode: "mock",
    abstained: false,
    actions,
    results: [answer],
    mentions: [],
  };
}

function lumiAnswering(actions: AgentReply["actions"]): LumiApi {
  const reply = replyWith(actions);
  return {
    ask: async () => ({ ok: true, value: reply }),
    search: async () => ({ ok: false, failure: "network" }),
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

// The floatie that opens the chat, so the chat has something to give focus back to.
function floatie() {
  const button = document.createElement("button");
  button.textContent = "Lumi";
  document.body.append(button);
  button.focus();
  return button;
}

function setUp(api: LumiApi, { reportSaved = true, mapDrawn = true } = {}) {
  const shown: SearchResponse[] = [];
  const focusWhen: Record<string, Element | null> = {};
  const navigator = { show: (response: SearchResponse) => void shown.push(response) };
  const calls = {
    shownOnMap: mock((response: SearchResponse) => {
      focusWhen["map"] = document.activeElement;
      return response.query;
    }),
    askOpened: mock(() => void (focusWhen["ask"] = document.activeElement)),
    reportMade: mock((response: SearchResponse) => Boolean(response) && reportSaved),
    reportsOpened: mock(() => void (focusWhen["reports"] = document.activeElement)),
  };
  const { result } = renderHook(() =>
    useWorldLumi({
      agentName: "Lumi",
      bear: defaultBear,
      lite: true,
      engineMode: "mock",
      fixtureMode: true,
      navigator,
      onShowOnMap: mapDrawn ? calls.shownOnMap : undefined,
      onOpenAsk: calls.askOpened,
      onMakeReport: calls.reportMade,
      onOpenReports: calls.reportsOpened,
      api,
    }),
  );
  const view = render(<>{result.current.chat as ReactNode}</>);
  const refresh = () => view.rerender(<>{result.current.chat as ReactNode}</>);
  return { result, refresh, shown, calls, focusWhen };
}

async function ask(refresh: () => void, open: () => void, text: string) {
  act(() => open());
  refresh();
  fireEvent.change(screen.getByLabelText("Message Lumi"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
  // The chat closes on the next render; what comes after waits for that.
  refresh();
  await act(async () => undefined);
}

test("show on map closes the chat and shows Lumi's answer on the map, once", async () => {
  const opener = floatie();
  const { result, refresh, calls, focusWhen } = setUp(
    lumiAnswering([{ type: "show_on_map", result: 0 }]),
  );
  await ask(refresh, result.current.open, "glucose sensors");
  expect(calls.shownOnMap.mock.calls).toEqual([[answer]]);
  expect(document.querySelector("dialog")!.open).toBe(false);
  // The map hides the floatie only once focus is back on it, so the shell can move focus on.
  expect(focusWhen["map"]).toBe(opener);
  expect(document.activeElement).toBe(opener);
});

test("without a map to draw, Lumi's show on map leaves the chat open", async () => {
  floatie();
  const { result, refresh } = setUp(lumiAnswering([{ type: "show_on_map", result: 0 }]), {
    mapDrawn: false,
  });
  await ask(refresh, result.current.open, "glucose sensors");
  // With a map, the chat closes to show the answer there (the test above).
  expect(document.querySelector("dialog")!.open).toBe(true);
  expect(screen.getAllByText("Demo reply.").length).toBeGreaterThan(0);
});

for (const mapDrawn of [true, false]) {
  test(`an answer that came while the chat was closed offers the map only when it is drawn (${mapDrawn ? "drawn" : "not drawn"})`, async () => {
    floatie();
    const api = held();
    const { result, refresh } = setUp(api, { mapDrawn });
    act(() => result.current.open());
    refresh();
    fireEvent.change(screen.getByLabelText("Message Lumi"), {
      target: { value: "glucose sensors" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    await act(async () => {
      document.querySelector("dialog")!.dispatchEvent(new Event("close"));
    });
    refresh();
    await act(async () =>
      api.land({ ok: true, value: replyWith([{ type: "show_on_map", result: 0 }]) }),
    );
    act(() => result.current.open());
    refresh();
    expect(document.querySelector("dialog")!.open).toBe(true);
    const offered = screen.queryByRole("button", { name: "Show on the map" });
    expect(offered !== null).toBe(mapDrawn);
  });
}

test("open profile shows Lumi's answer in Ask once the chat has given focus back", async () => {
  const opener = floatie();
  const { result, refresh, shown, calls, focusWhen } = setUp(
    lumiAnswering([{ type: "open_profile", profile_id: profileId }]),
  );
  await ask(refresh, result.current.open, "glucose sensors");
  expect(shown).toEqual([answer]);
  expect(calls.askOpened).toHaveBeenCalledTimes(1);
  expect(document.querySelector("dialog")!.open).toBe(false);
  // So the phone records a live element to give focus back to when it closes.
  expect(focusWhen["ask"]).toBe(opener);
});

/** A report waits for the player's click on the reply (features/lumi), then the chat closes. */
async function makeReport(refresh: () => void) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Make a match report" }));
  });
  refresh();
  await act(async () => undefined);
}

test("a match report is kept and opens in the desk's Reports window, not a new tab", async () => {
  const opener = floatie();
  const { result, refresh, calls, focusWhen } = setUp(
    lumiAnswering([{ type: "start_match_report", result: 0 }]),
  );
  await ask(refresh, result.current.open, "glucose sensors");
  expect(calls.reportMade).not.toHaveBeenCalled();
  await makeReport(refresh);
  expect(calls.reportMade.mock.calls).toEqual([[answer]]);
  expect(calls.reportsOpened).toHaveBeenCalledTimes(1);
  expect(focusWhen["reports"]).toBe(opener);
});

test("a report the browser cannot keep leaves the chat open, says why and keeps its button", async () => {
  floatie();
  const { result, refresh, calls } = setUp(
    lumiAnswering([{ type: "start_match_report", result: 0 }]),
    { reportSaved: false },
  );
  await ask(refresh, result.current.open, "glucose sensors");
  await makeReport(refresh);
  expect(calls.reportMade).toHaveBeenCalledTimes(1);
  expect(calls.reportsOpened).not.toHaveBeenCalled();
  expect(document.querySelector("dialog")!.open).toBe(true);
  expect(screen.getByRole("alert").textContent).toBe(
    "This browser blocks storage, so the report could not be kept. Allow site storage and try again.",
  );
  expect(screen.getByRole("button", { name: "Make a match report" })).toBeTruthy();
});

/** Lumi's floatie, the phone and the chat, wired as the world app wires them. */
function World({ api, shown }: { api: LumiApi; shown: SearchResponse[] }) {
  const phone = useWorldPhone();
  const lumi = useWorldLumi({
    agentName: "Lumi",
    bear: defaultBear,
    lite: true,
    engineMode: "mock",
    fixtureMode: true,
    navigator: { show: (response) => void shown.push(response) },
    onShowOnMap: () => undefined,
    onOpenAsk: () => phone.openApp("ask"),
    onMakeReport: () => false,
    onOpenReports: () => undefined,
    api,
  });
  const ask = { id: "ask", label: "Ask", icon: null, tile: "#13804a", content: <p>Ask</p> };
  return (
    <>
      {lumi.floatie}
      <Phone
        open={phone.open}
        onClose={() => phone.setOpen(false)}
        apps={[ask]}
        appId={phone.appId}
        onAppChange={phone.setAppId}
        now={null}
      />
      {lumi.chat}
    </>
  );
}

test("open profile from the floatie: Ask shows in the phone, and closing it focuses the floatie", async () => {
  const shown: SearchResponse[] = [];
  render(
    <World api={lumiAnswering([{ type: "open_profile", profile_id: profileId }])} shown={shown} />,
  );
  const floatie = screen.getByRole("button", { name: "Lumi, your agent" });
  act(() => floatie.focus());
  act(() => fireEvent.click(floatie));
  fireEvent.change(screen.getByLabelText("Message Lumi"), { target: { value: "glucose" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
  const phone = document.querySelector<HTMLDialogElement>('dialog[aria-label="Phone"]')!;
  expect(shown).toEqual([answer]);
  expect(phone.open).toBe(true);
  expect(document.activeElement).toBe(within(phone).getByRole("heading", { name: "Ask" }));
  await act(async () => {
    fireEvent.click(within(phone).getByRole("button", { name: /Close/ }));
  });
  expect(phone.open).toBe(false);
  expect(document.activeElement).toBe(floatie);
});
