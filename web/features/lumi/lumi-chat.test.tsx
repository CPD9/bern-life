import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import agentJson from "../../../contracts/fixtures/agent.json";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { abstainedFixture, resultFixture } from "@/test/fixtures";
import { type AgentReply, parseAgentReply } from "./agent-reply";
import type { ChatMessage, LumiApi, LumiFailure, Outcome } from "./lumi-api";
import { LumiChat, type LumiChatProps } from "./lumi-chat";
import { suggestions } from "./suggestions";

const reply = parseAgentReply(agentJson)!;
const failed = (failure: LumiFailure) => ({ ok: false, failure }) as const;

type Calls = { asked: ChatMessage[][]; searched: string[] };

function scripted(
  replies: Outcome<AgentReply>[],
  searches: Outcome<SearchResponse>[] = [],
): LumiApi & { calls: Calls } {
  const calls: Calls = { asked: [], searched: [] };
  return {
    calls,
    ask: async (messages) => {
      calls.asked.push([...messages]);
      return replies.shift()!;
    },
    search: async (query) => {
      calls.searched.push(query);
      return searches.shift()!;
    },
  };
}

type HarnessProps = Omit<LumiChatProps, "open" | "onClose">;

function Harness(props: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Lumi
      </button>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <LumiChat open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

function openPanel() {
  const opener = screen.getByRole("button", { name: "Lumi" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

async function say(text: string) {
  fireEvent.change(screen.getByLabelText("Message Lumi"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
}

describe("LumiChat", () => {
  test("opens with focus in the message box and gives focus back on close", async () => {
    render(<Harness api={scripted([])} />);
    const opener = openPanel();
    expect(document.querySelector("dialog")!.open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Message Lumi"));
    await act(async () => {
      document.querySelector("dialog")!.dispatchEvent(new Event("close"));
    });
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(document.activeElement).toBe(opener);
  });

  test("a suggestion sends its exact words, and the reply shows its text, card and mode", async () => {
    const api = scripted([{ ok: true, value: reply }]);
    render(<Harness api={api} />);
    openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: suggestions[1]!.label }));
    });
    expect(api.calls.asked).toEqual([
      [
        {
          role: "user",
          content:
            "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?",
        },
      ],
    ]);
    expect(screen.getByText(/I lit up her unit on the map\./)).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("MOCK")).toBeTruthy();
    expect(api.calls.searched).toEqual([]);
  });

  test("each action in a reply is dispatched once, and never again on re-render", async () => {
    const shown: SearchResponse[] = [];
    const opened: string[] = [];
    const reported: SearchResponse[] = [];
    const withReport: AgentReply = {
      ...reply,
      actions: [...reply.actions, { type: "start_match_report", result: 0 }],
    };
    const api = scripted([
      { ok: true, value: withReport },
      { ok: true, value: { ...reply, actions: [] } },
    ]);
    const props: HarnessProps = {
      api,
      onShowOnMap: (response) => void shown.push(response),
      onOpenProfile: (id) => void opened.push(id),
      onStartMatchReport: (response) => void reported.push(response),
    };
    const { rerender } = render(<Harness {...props} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    rerender(<Harness {...props} />);
    rerender(<Harness {...props} agentName="Lumi" />);
    await say("Thanks");
    expect(shown).toEqual([reply.results[0]!]);
    expect(opened).toEqual(["person-example-ada-muster"]);
    expect(reported).toEqual([reply.results[0]!]);
  });

  test("a mention in the reply moves focus to its card", async () => {
    render(<Harness api={scripted([{ ok: true, value: reply }])} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    fireEvent.click(screen.getByRole("button", { name: "Ada Muster, see the card" }));
    const focused = document.activeElement as HTMLElement;
    expect(focused.tagName).toBe("LI");
    expect(focused.querySelector("h3")!.textContent).toBe("Ada Muster");
  });

  test("the second message carries the first exchange", async () => {
    const api = scripted([
      { ok: true, value: reply },
      { ok: true, value: { ...reply, actions: [] } },
    ]);
    render(<Harness api={api} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    await say("Show them on the map");
    expect(api.calls.asked[1]).toEqual([
      { role: "user", content: "Who works on glucose sensors at DCB?" },
      { role: "assistant", content: reply.reply },
      { role: "user", content: "Show them on the map" },
    ]);
  });

  test("a 404 says Lumi is not connected yet, and the plain search answers, labelled", async () => {
    const api = scripted([failed("not_connected")], [{ ok: true, value: resultFixture }]);
    render(<Harness api={api} />);
    openPanel();
    await say("glucose sensors");
    expect(screen.getByText("Lumi is not connected yet.")).toBeTruthy();
    expect(api.calls.searched).toEqual(["glucose sensors"]);
    const plain = screen.getByRole("region", { name: "Plain search answer, not Lumi's" });
    expect(plain.querySelectorAll("article")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("when Lumi abstains, its words stay its own and the plain search is labelled", async () => {
    const abstained: AgentReply = {
      ...reply,
      reply: "I found no verifiable source for that.",
      abstained: true,
      actions: [],
      results: [],
      mentions: [],
    };
    const api = scripted([{ ok: true, value: abstained }], [{ ok: true, value: abstainedFixture }]);
    render(<Harness api={api} />);
    openPanel();
    await say("What has Prof. Lukas Thalmann published?");
    expect(screen.getByText("I found no verifiable source for that.")).toBeTruthy();
    const plain = screen.getByRole("region", { name: "Plain search answer, not Lumi's" });
    expect(plain.textContent).toContain(
      "No public page we hold supports an answer to this. We would rather say so than guess.",
    );
  });

  test("no server: a plain sentence, no search, and Try again resends the same message", async () => {
    const api = scripted([failed("network"), { ok: true, value: reply }]);
    render(<Harness api={api} />);
    openPanel();
    await say("glucose sensors");
    expect(
      screen.getByText(
        "We could not reach the Bern Life server. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(api.calls.searched).toEqual([]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(api.calls.asked).toEqual([
      [{ role: "user", content: "glucose sensors" }],
      [{ role: "user", content: "glucose sensors" }],
    ]);
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  test("an unreadable reply and a failed search show sentences, never a partial answer", async () => {
    const api = scripted([failed("malformed")], [failed("engine_error")]);
    render(<Harness api={api} agentName="Bruno" />);
    openPanel();
    fireEvent.change(screen.getByLabelText("Message Bruno"), { target: { value: "CGM" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(
      screen.getByText("Bruno's answer could not be read, so nothing of it is shown."),
    ).toBeTruthy();
    expect(
      screen.getByText("The search is not answering right now. Try again in a moment."),
    ).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  test("the mode chip comes from health until a reply says otherwise", async () => {
    render(<Harness api={scripted([{ ok: true, value: reply }])} engineMode="replay" />);
    openPanel();
    expect(screen.getByText("Replay")).toBeTruthy();
    await say("glucose sensors");
    expect(screen.queryByText("Replay")).toBeNull();
    expect(screen.getByText("MOCK")).toBeTruthy();
  });
});
