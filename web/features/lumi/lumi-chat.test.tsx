import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { abstainedFixture, resultFixture } from "@/test/fixtures";
import type { AgentReply } from "./agent-reply";
import { suggestions } from "./suggestions";
import {
  Harness,
  closePanel,
  conversation,
  failed,
  held,
  openPanel,
  reply,
  say,
  scripted,
} from "./test-harness";

const demoBrief =
  "Muster Medtech AG (an invented company) is building a night-time alarm for people with type 1 diabetes who live alone. We need partners in Bern for continuous glucose sensing, for detecting sleep and movement at night, and for testing such a device with older patients.";
const demoQuestion =
  "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?";

describe("LumiChat", () => {
  test("opens with focus in the message box and gives focus back on close", async () => {
    render(<Harness api={scripted([])} />);
    const opener = openPanel();
    expect(document.querySelector("dialog")!.open).toBe(true);
    expect(screen.getByText("Your agent")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Message Lumi"));
    await closePanel();
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(document.activeElement).toBe(opener);
  });

  test("the suggestions are docs/demo.md steps 1 and 2, word for word", () => {
    expect(suggestions.map((suggestion) => suggestion.text)).toEqual([demoBrief, demoQuestion]);
  });

  test("a suggestion sends its exact words, then focus is in the message box", async () => {
    const api = scripted([{ ok: true, value: reply }]);
    render(<Harness api={api} fixtureMode />);
    openPanel();
    const chip = screen.getByRole("button", { name: demoQuestion });
    chip.focus();
    await act(async () => {
      fireEvent.click(chip);
    });
    expect(api.calls.asked).toEqual([[{ role: "user", content: demoQuestion }]]);
    expect(conversation().getByText(/I lit up her unit on the map\./)).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("MOCK")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Message Lumi"));
    expect(api.calls.searched).toEqual([]);
  });

  test("outside fixture mode a mock answer says Plain search, never MOCK", async () => {
    const api = scripted(
      [failed("not_connected"), { ok: true, value: reply }],
      [{ ok: true, value: resultFixture }],
    );
    render(<Harness api={api} engineMode="replay" />);
    openPanel();
    expect(screen.getByText("Replay")).toBeTruthy();
    await say("glucose sensors");
    await say("CGM");
    expect(screen.queryByText("Replay")).toBeNull();
    expect(screen.queryByText("MOCK")).toBeNull();
    expect(screen.getAllByText("Plain search")).toHaveLength(2);
  });

  test("before a reply the chip says what the HUD says; an answer follows the answer rule", async () => {
    const api = scripted([{ ok: true, value: reply }]);
    render(<Harness api={api} engineMode="mock" />);
    openPanel();
    expect(screen.getByText("MOCK")).toBeTruthy();
    await say("glucose sensors");
    expect(screen.queryByText("MOCK")).toBeNull();
    expect(screen.getByText("Plain search")).toBeTruthy();
  });

  test("one status line says what changed, and the cards are not announced", async () => {
    const api = held();
    render(<Harness api={api} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    expect(screen.getByRole("status").textContent).toBe("Lumi is answering…");
    await act(async () => api.land({ ok: true, value: reply }));
    expect(screen.getByRole("status").textContent).toBe(`${reply.reply} 1 card.`);
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(0);
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
    expect(screen.getByRole("status").textContent).toBe(
      "Lumi is not connected yet. Plain search answer: 1 result.",
    );
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

  test("no server: a sentence, no search, and Try again resends with focus in the box", async () => {
    const api = scripted([failed("network"), { ok: true, value: reply }]);
    render(<Harness api={api} />);
    openPanel();
    await say("glucose sensors");
    expect(
      conversation().getByText(
        "We could not reach the Bern Life server. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(api.calls.searched).toEqual([]);
    const tryAgain = screen.getByRole("button", { name: "Try again" });
    tryAgain.focus();
    await act(async () => {
      fireEvent.click(tryAgain);
    });
    expect(api.calls.asked).toEqual([
      [{ role: "user", content: "glucose sensors" }],
      [{ role: "user", content: "glucose sensors" }],
    ]);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByLabelText("Message Lumi"));
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

  test("a refusal over the limit says to wait, for Lumi and for the plain search", async () => {
    const api = scripted([failed("rate_limited")], [failed("rate_limited")]);
    render(<Harness api={api} />);
    openPanel();
    fireEvent.change(screen.getByLabelText("Message Lumi"), { target: { value: "CGM" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(
      screen.getAllByText("Too many requests from here right now; try again in a few minutes."),
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("a plain search over the limit offers no Try again either", async () => {
    const api = scripted([failed("engine_error")], [failed("rate_limited")]);
    render(<Harness api={api} />);
    openPanel();
    await say("CGM");
    expect(
      screen.getByText("Too many requests from here right now; try again in a few minutes."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(api.calls.asked).toHaveLength(1);
    expect(api.calls.searched).toEqual(["CGM"]);
  });
});
