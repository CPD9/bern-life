import { describe, expect, test } from "bun:test";
import agentJson from "../../../contracts/fixtures/agent.json";
import { copyOf } from "@/test/fixtures";
import { parseAgentReply } from "./agent-reply";

describe("parseAgentReply", () => {
  test("the contract fixture parses into what the panel renders", () => {
    const reply = parseAgentReply(agentJson);
    expect(reply).not.toBeNull();
    expect(reply!.reply).toBe(
      "Ada Muster leads the GlucoPatch sensor project and lists continuous glucose monitoring as a research topic. I lit up her unit on the map.",
    );
    expect(reply!.mode).toBe("mock");
    expect(reply!.abstained).toBe(false);
    expect(reply!.actions).toEqual([
      { type: "show_on_map", result: 0 },
      { type: "open_profile", profile_id: "person-example-ada-muster" },
    ]);
    expect(reply!.mentions).toEqual([
      { profile_id: "person-example-ada-muster", name: "Ada Muster" },
    ]);
    expect(reply!.results.map((response) => response.results.map((r) => r.profile.id))).toEqual([
      ["person-example-ada-muster"],
    ]);
  });

  test("a reply without abstained has not abstained", () => {
    const body: Record<string, unknown> = copyOf(agentJson);
    delete body.abstained;
    expect(parseAgentReply(body)?.abstained).toBe(false);
  });

  test("a reply missing its text, or with an unknown mode, is no reply", () => {
    const noText: Record<string, unknown> = copyOf(agentJson);
    delete noText.reply;
    expect(parseAgentReply(noText)).toBeNull();
    expect(parseAgentReply({ ...copyOf(agentJson), mode: "guess" })).toBeNull();
    expect(parseAgentReply("Ada Muster")).toBeNull();
    expect(parseAgentReply(null)).toBeNull();
  });

  test("one bad action, mention or search answer rejects the whole reply", () => {
    const action = copyOf(agentJson);
    action.actions.push({ type: "send_email", result: 0 });
    expect(parseAgentReply(action)).toBeNull();

    const index = copyOf(agentJson);
    index.actions[0]!.result = -1;
    expect(parseAgentReply(index)).toBeNull();

    const mention = copyOf(agentJson);
    mention.mentions.push({ profile_id: "person-example-ada-muster" } as never);
    expect(parseAgentReply(mention)).toBeNull();

    const tooMany = copyOf(agentJson);
    tooMany.actions = Array.from({ length: 7 }, () => ({ type: "show_on_map", result: 0 }));
    expect(parseAgentReply(tooMany)).toBeNull();

    const result = copyOf(agentJson);
    delete (result.results[0]!.results[0]!.profile as Record<string, unknown>).name;
    expect(parseAgentReply(result)).toBeNull();
  });

  test("a reply the schema rejects is no reply, even where the panel would not look", () => {
    const noVersions: Record<string, unknown> = copyOf(agentJson);
    delete noVersions.versions;
    expect(parseAgentReply(noVersions)).toBeNull();
    expect(parseAgentReply({ ...copyOf(agentJson), note: "extra" })).toBeNull();
    expect(parseAgentReply({ ...copyOf(agentJson), reply: "a".repeat(801) })).toBeNull();
  });

  test("a reply naming someone who has no card is no reply", () => {
    const unsourced = copyOf(agentJson);
    unsourced.mentions.push({
      profile_id: "person-example-lukas-thalmann",
      name: "Lukas Thalmann",
    });
    expect(parseAgentReply(unsourced)).toBeNull();
  });
});
