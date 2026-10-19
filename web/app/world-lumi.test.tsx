import { expect, mock, test } from "bun:test";
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

function setUp(api: LumiApi) {
  const shown: SearchResponse[] = [];
  const navigator = { show: (response: SearchResponse) => void shown.push(response) };
  const calls = {
    shownOnMap: mock((response: SearchResponse) => response.query),
    askOpened: mock(() => undefined),
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
      api,
    }),
  );
  const view = render(<>{result.current.chat as ReactNode}</>);
  const refresh = () => view.rerender(<>{result.current.chat as ReactNode}</>);
  return { result, refresh, shown, calls };
}

async function ask(refresh: () => void, open: () => void, text: string) {
  act(() => open());
  refresh();
  fireEvent.change(screen.getByLabelText("Message Lumi"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
  refresh();
}

test("show on map closes the chat and shows Lumi's answer on the map, once", async () => {
  const { result, refresh, calls } = setUp(lumiAnswering([{ type: "show_on_map", result: 0 }]));
  await ask(refresh, result.current.open, "glucose sensors");
  expect(calls.shownOnMap.mock.calls).toEqual([[answer]]);
  expect(document.querySelector("dialog")!.open).toBe(false);
});

test("open profile shows the answer that lists the profile in Ask, without a second search", async () => {
  const { result, refresh, shown, calls } = setUp(
    lumiAnswering([{ type: "open_profile", profile_id: profileId }]),
  );
  await ask(refresh, result.current.open, "glucose sensors");
  expect(shown).toEqual([answer]);
  expect(calls.askOpened).toHaveBeenCalledTimes(1);
  expect(document.querySelector("dialog")!.open).toBe(false);
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
