import { describe, expect, test } from "bun:test";
import agentJson from "../../../contracts/fixtures/agent.json";
import { copyOf, resultFixture, viaFixture } from "@/test/fixtures";
import { parseAgentReply } from "./agent-reply";
import { type Turn, answerCards, maxMessages, messagesFor, splitMentions } from "./conversation";

const reply = parseAgentReply(agentJson)!;

function turn(id: number, answered: boolean): Turn {
  return {
    id,
    text: `question ${id}`,
    lumi: answered
      ? { status: "replied", reply: { ...reply, reply: `answer ${id}` } }
      : { status: "failed", failure: "engine_error" },
    search: null,
  };
}

describe("messagesFor", () => {
  test("sends what was said, Lumi's replies included, newest last", () => {
    expect(messagesFor([turn(0, true), turn(1, false)], "question 2")).toEqual([
      { role: "user", content: "question 0" },
      { role: "assistant", content: "answer 0" },
      { role: "user", content: "question 1" },
      { role: "user", content: "question 2" },
    ]);
  });

  test("keeps the newest twelve messages, starting with a question", () => {
    const sixTurns = [0, 1, 2, 3, 4, 5].map((id) => turn(id, false));
    const sent = messagesFor([...sixTurns, ...sixTurns.map((t) => turn(t.id + 6, false))], "q");
    expect(maxMessages).toBe(12);
    expect(sent).toHaveLength(12);
    expect(sent[0]).toEqual({ role: "user", content: "question 1" });
    expect(sent.at(-1)).toEqual({ role: "user", content: "q" });

    const answered = messagesFor(
      [0, 1, 2, 3, 4, 5, 6].map((id) => turn(id, true)),
      "question 7",
    );
    expect(answered).toHaveLength(11);
    expect(answered[0]).toEqual({ role: "user", content: "question 2" });
    expect(answered.at(-1)).toEqual({ role: "user", content: "question 7" });
  });
});

describe("splitMentions", () => {
  test("a mentioned name becomes a link to its card", () => {
    const ids = new Set(["person-example-ada-muster"]);
    expect(splitMentions(reply.reply, reply.mentions, ids)).toEqual([
      { kind: "mention", text: "Ada Muster", profileId: "person-example-ada-muster" },
      {
        kind: "text",
        text: " leads the GlucoPatch sensor project and lists continuous glucose monitoring as a research topic. I lit up her unit on the map.",
      },
    ]);
  });

  test("a mention without a card stays plain text, and the longer name wins", () => {
    const mentions = [
      { profile_id: "person-a", name: "Ada" },
      { profile_id: "person-b", name: "Ada Muster" },
      { profile_id: "person-c", name: "Lena Beispiel" },
    ];
    const ids = new Set(["person-a", "person-b"]);
    expect(splitMentions("Ask Ada Muster or Ada, not Lena Beispiel.", mentions, ids)).toEqual([
      { kind: "text", text: "Ask " },
      { kind: "mention", text: "Ada Muster", profileId: "person-b" },
      { kind: "text", text: " or " },
      { kind: "mention", text: "Ada", profileId: "person-a" },
      { kind: "text", text: ", not Lena Beispiel." },
    ]);
  });
});

describe("answerCards", () => {
  test("lists each profile once across the searches behind a reply", () => {
    const cards = answerCards([resultFixture, copyOf(resultFixture), viaFixture]);
    expect(cards.map((card) => card.profile.id)).toEqual([
      "person-example-ada-muster",
      ...viaFixture.results.map((result) => result.profile.id),
    ]);
  });
});
