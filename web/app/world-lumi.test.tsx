import { expect, mock, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { defaultBear } from "@/features/avatar/bear-config";
import type { AgentReply } from "@/features/lumi/agent-reply";
import type { LumiApi } from "@/features/lumi/lumi-api";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchRequest } from "@/infrastructure/engine-types";
import { resultFixture } from "@/test/fixtures";
import { useWorldLumi } from "./world-lumi";

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
  const searched: SearchRequest[] = [];
  const navigator = { search: (request: SearchRequest) => void searched.push(request) };
  const calls = {
    shownOnMap: mock((response: SearchResponse) => response.query),
    handedOver: mock((response: SearchResponse) => response.query),
    askOpened: mock(() => undefined),
  };
  const { result } = renderHook(() =>
    useWorldLumi({
      agentName: "Lumi",
      bear: defaultBear,
      lite: true,
      engineMode: "mock",
      fixtureMode: true,
      navigator: navigator as unknown as NavigatorController,
      handOver: calls.handedOver,
      onShowOnMap: calls.shownOnMap,
      onOpenAsk: calls.askOpened,
      api,
    }),
  );
  const view = render(<>{result.current.chat as ReactNode}</>);
  const refresh = () => view.rerender(<>{result.current.chat as ReactNode}</>);
  return { result, refresh, searched, calls };
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
  const { result, refresh, searched, calls } = setUp(
    lumiAnswering([{ type: "open_profile", profile_id: profileId }]),
  );
  await ask(refresh, result.current.open, "glucose sensors");
  expect(calls.handedOver.mock.calls).toEqual([[answer]]);
  expect(searched).toEqual([{ query: answer.query }]);
  expect(calls.askOpened).toHaveBeenCalledTimes(1);
  expect(document.querySelector("dialog")!.open).toBe(false);
});

test("a profile no answer lists leaves the chat open and Ask alone", async () => {
  const { result, refresh, searched, calls } = setUp(
    lumiAnswering([{ type: "open_profile", profile_id: "person-demo-nobody" }]),
  );
  await ask(refresh, result.current.open, "glucose sensors");
  expect(searched).toEqual([]);
  expect(calls.askOpened).not.toHaveBeenCalled();
  expect(document.querySelector("dialog")!.open).toBe(true);
});
