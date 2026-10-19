import { describe, expect, test } from "bun:test";
import type { AgentReply } from "@/features/lumi/agent-reply";
import type { LumiApi } from "@/features/lumi/lumi-api";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import type { SearchRequest } from "@/infrastructure/engine-types";
import { copyOf, resultFixture } from "@/test/fixtures";
import { handOverNavigatorApi, rememberingLumiApi } from "./lumi-handoff";

const answer = resultFixture;
const profileId = answer.results[0]!.profile.id;

function lumiReplying(reply: AgentReply | null): LumiApi {
  return {
    ask: async () => (reply ? { ok: true, value: reply } : { ok: false, failure: "network" }),
    search: async () => ({ ok: false, failure: "network" }),
  };
}

const reply: AgentReply = {
  reply: "Demo reply.",
  mode: "mock",
  abstained: false,
  actions: [{ type: "open_profile", profile_id: profileId }],
  results: [answer],
  mentions: [],
};

describe("rememberingLumiApi", () => {
  test("finds the answer in Lumi's latest reply that lists a profile", async () => {
    const api = rememberingLumiApi(lumiReplying(reply));
    expect(api.answerListing(profileId)).toBeNull();
    await api.ask([{ role: "user", content: "glucose sensors" }]);
    expect(api.answerListing(profileId)).toBe(answer);
    expect(api.answerListing("person-nobody")).toBeNull();
  });

  test("a failed reply forgets the answers before it", async () => {
    let next: AgentReply | null = reply;
    const api = rememberingLumiApi({
      ...lumiReplying(null),
      ask: async () => (next ? { ok: true, value: next } : { ok: false, failure: "network" }),
    });
    await api.ask([{ role: "user", content: "glucose sensors" }]);
    next = null;
    await api.ask([{ role: "user", content: "again" }]);
    expect(api.answerListing(profileId)).toBeNull();
  });
});

describe("handOverNavigatorApi", () => {
  function engine() {
    const asked: SearchRequest[] = [];
    const api: NavigatorApi = {
      search: async (request) => {
        asked.push(request);
        return { ok: false, failure: { kind: "network" } };
      },
      brief: async () => ({ ok: false, failure: { kind: "network" } }),
    };
    return { asked, api: handOverNavigatorApi(api) };
  }

  test("the next search for the handed answer's query gets it, without asking the engine", async () => {
    const { asked, api } = engine();
    api.handOver(answer);
    expect(await api.search({ query: answer.query })).toEqual({ ok: true, response: answer });
    expect(asked).toEqual([]);
  });

  test("the handed answer serves once, and never another question", async () => {
    const { asked, api } = engine();
    api.handOver(answer);
    await api.search({ query: answer.query });
    await api.search({ query: answer.query });
    api.handOver(copyOf(answer));
    await api.search({ query: "something else" });
    await api.search({ query: answer.query });
    expect(asked.map((request) => request.query)).toEqual([
      answer.query,
      "something else",
      answer.query,
    ]);
  });
});
