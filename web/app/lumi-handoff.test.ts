import { describe, expect, test } from "bun:test";
import type { AgentReply } from "@/features/lumi/agent-reply";
import type { LumiApi } from "@/features/lumi/lumi-api";
import { resultFixture } from "@/test/fixtures";
import { rememberingLumiApi } from "./lumi-handoff";

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
