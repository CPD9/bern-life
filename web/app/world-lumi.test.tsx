import { afterEach, expect, mock, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { defaultBear } from "@/features/avatar/bear-config";
import type { AgentReply } from "@/features/lumi/agent-reply";
import type { LumiApi } from "@/features/lumi/lumi-api";
import { Phone } from "@/features/phone/phone";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { resultFixture } from "@/test/fixtures";
import { useWorldLumi } from "./world-lumi";
import { useWorldPhone } from "./world-phone";

const answer = resultFixture;
const profileId = answer.results[0]!.profile.id;

function lumiAnswering(actions: AgentReply["actions"]): LumiApi {
  const reply: AgentReply = {
    reply: "Demo reply.",
    mode: "mock",
    abstained: false,
    actions,
    results: [answer],
    mentions: [],
  };
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

function setUp(api: LumiApi, { reportSaved = true } = {}) {
  const shown: SearchResponse[] = [];
  const focusWhen: Record<string, Element | null> = {};
  const navigator = { show: (response: SearchResponse) => void shown.push(response) };
  const calls = {
    shownOnMap: mock((response: SearchResponse) => response.query),
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
      onShowOnMap: calls.shownOnMap,
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
  const { result, refresh, calls } = setUp(lumiAnswering([{ type: "show_on_map", result: 0 }]));
  await ask(refresh, result.current.open, "glucose sensors");
  expect(calls.shownOnMap.mock.calls).toEqual([[answer]]);
  expect(document.querySelector("dialog")!.open).toBe(false);
  expect(document.activeElement).toBe(opener);
});

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

test("a report the browser cannot keep leaves the chat open and the desk closed", async () => {
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
