// Shared by the panel's tests: a panel with an opener button, and fake APIs that either answer at
// once from a script or hold each answer until the test lets it land.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import agentJson from "../../../contracts/fixtures/agent.json";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { type AgentReply, parseAgentReply } from "./agent-reply";
import type { ChatMessage, LumiApi, LumiFailure, Outcome } from "./lumi-api";
import { LumiChat, type LumiChatProps } from "./lumi-chat";

export const reply: AgentReply = parseAgentReply(agentJson)!;

export const failed = (failure: LumiFailure) => ({ ok: false, failure }) as const;

export type Calls = { asked: ChatMessage[][]; searched: string[] };

export function scripted(
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

/** Each reply waits until `land` is called, so a test can act while it is on its way. */
export function held(): LumiApi & { calls: Calls; land(outcome: Outcome<AgentReply>): void } {
  const calls: Calls = { asked: [], searched: [] };
  const waiting: ((outcome: Outcome<AgentReply>) => void)[] = [];
  return {
    calls,
    ask: (messages) => {
      calls.asked.push([...messages]);
      return new Promise((resolve) => waiting.push(resolve));
    },
    search: async (query) => {
      calls.searched.push(query);
      return failed("engine_error");
    },
    land: (outcome) => waiting.shift()!(outcome),
  };
}

export type HarnessProps = Omit<LumiChatProps, "open" | "onClose" | "fixtureMode"> & {
  fixtureMode?: boolean;
};

export function Harness({ fixtureMode = false, ...props }: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Bärnli
      </button>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <LumiChat open={open} onClose={() => setOpen(false)} fixtureMode={fixtureMode} {...props} />
    </>
  );
}

export function openPanel() {
  const opener = screen.getByRole("button", { name: "Bärnli" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

export async function closePanel() {
  await act(async () => {
    document.querySelector("dialog")!.dispatchEvent(new Event("close"));
  });
}

export async function say(text: string) {
  fireEvent.change(screen.getByLabelText("Message Bärnli"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
}

/** Queries inside the conversation, leaving out the status line that repeats its latest words. */
export function conversation(name = "Bärnli") {
  return within(screen.getByRole("list", { name: `Conversation with ${name}` }));
}
