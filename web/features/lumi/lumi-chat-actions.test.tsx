import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { AgentReply } from "./agent-reply";
import {
  Harness,
  conversation,
  type HarnessProps,
  closePanel,
  held,
  openPanel,
  reply,
  say,
  scripted,
} from "./test-harness";

/** Lets every pending promise settle, the way a reply lands between two renders. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A host that keeps every report it is asked for, noting each. */
const keepsInto = (reported: SearchResponse[]) => (response: SearchResponse) => {
  reported.push(response);
  return true;
};

describe("LumiChat actions", () => {
  test("each action in a reply is dispatched once, and never again on re-render", async () => {
    const shown: SearchResponse[] = [];
    const opened: [string, SearchResponse][] = [];
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
      onOpenProfile: (id, response) => void opened.push([id, response]),
      onStartMatchReport: keepsInto(reported),
    };
    const { rerender } = render(<Harness {...props} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    rerender(<Harness {...props} />);
    rerender(<Harness {...props} agentName="Bärli" />);
    await say("Thanks");
    expect(shown).toEqual([reply.results[0]!]);
    expect(opened).toEqual([["person-example-ada-muster", reply.results[0]!]]);
    // A report keeps a record, so it waits for a click (the next test).
    expect(reported).toEqual([]);
  });

  const withReport: AgentReply = {
    ...reply,
    actions: [{ type: "start_match_report", result: 0 }],
  };

  test("a match report waits for the player's click with the panel open, then opens once", async () => {
    const reported: SearchResponse[] = [];
    const api = scripted([{ ok: true, value: withReport }]);
    render(<Harness api={api} onStartMatchReport={keepsInto(reported)} />);
    openPanel();
    await say("Make a match report for glucose sensors");
    expect(reported).toEqual([]);
    expect(screen.queryByText(/while the panel was closed/)).toBeNull();
    const make = screen.getByRole("button", { name: "Make a match report" });
    make.focus();
    act(() => {
      fireEvent.click(make);
      fireEvent.click(make);
    });
    expect(reported).toEqual([reply.results[0]!]);
    expect(screen.queryByRole("button", { name: "Make a match report" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Message Bärli"));
  });

  test("a report the browser does not keep says so and stays offered, and a retry can keep it", async () => {
    const kept = [false, true];
    const tried: SearchResponse[] = [];
    const api = scripted([{ ok: true, value: withReport }]);
    render(
      <Harness
        api={api}
        onStartMatchReport={(response) => {
          tried.push(response);
          return kept.shift()!;
        }}
      />,
    );
    openPanel();
    await say("Make a match report for glucose sensors");
    const make = screen.getByRole("button", { name: "Make a match report" });
    make.focus();
    act(() => fireEvent.click(make));
    expect(tried).toEqual([reply.results[0]!]);
    expect(screen.getByRole("alert").textContent).toBe(
      "This browser blocks storage, so the report could not be kept. Allow site storage and try again.",
    );
    expect(document.activeElement).toBe(make);

    act(() => fireEvent.click(make));
    expect(tried).toEqual([reply.results[0]!, reply.results[0]!]);
    expect(screen.queryByRole("button", { name: "Make a match report" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Message Bärli"));
  });

  test("a reply acts through the callbacks given when it lands", async () => {
    const opened: string[] = [];
    const api = held();
    const { rerender } = render(
      <Harness api={api} onOpenProfile={(id) => void opened.push(`first ${id}`)} />,
    );
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    rerender(<Harness api={api} onOpenProfile={(id) => void opened.push(`latest ${id}`)} />);
    await act(async () => api.land({ ok: true, value: reply }));
    expect(opened).toEqual(["latest person-example-ada-muster"]);
  });

  test("a reply that lands after the panel closed waits for a click, then acts once", async () => {
    const shown: SearchResponse[] = [];
    const opened: [string, SearchResponse][] = [];
    const api = held();
    const props: HarnessProps = {
      api,
      onShowOnMap: (response) => void shown.push(response),
      onOpenProfile: (id, response) => void opened.push([id, response]),
    };
    const { rerender } = render(<Harness {...props} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    await closePanel();
    await act(async () => api.land({ ok: true, value: reply }));
    expect(shown).toEqual([]);
    expect(opened).toEqual([]);

    openPanel();
    const heldLine = "This answer came while the panel was closed. Choose what to do:";
    expect(screen.getByText(heldLine)).toBeTruthy();
    const showOnMap = screen.getByRole("button", { name: "Show on the map" });
    showOnMap.focus();
    act(() => {
      fireEvent.click(showOnMap);
      fireEvent.click(showOnMap);
    });
    rerender(<Harness {...props} />);
    expect(shown).toEqual([reply.results[0]!]);
    expect(screen.queryByRole("button", { name: "Show on the map" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Message Bärli"));
    expect(screen.getByText(heldLine)).toBeTruthy();
    expect(screen.queryByText(/nothing was done/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open the card" }));
    expect(opened).toEqual([["person-example-ada-muster", reply.results[0]!]]);
    expect(shown).toHaveLength(1);
    expect(screen.queryByText(/while the panel was closed/)).toBeNull();
  });
});

describe("LumiChat sending", () => {
  test("Enter pressed as a reply lands neither sends nor replaces the reply", async () => {
    const api = held();
    render(<Harness api={api} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    const box = screen.getByLabelText("Message Bärli");
    fireEvent.change(box, { target: { value: "Show them on the map" } });
    await act(async () => {
      api.land({ ok: true, value: reply });
      await settle();
      fireEvent.keyDown(box, { key: "Enter" });
    });
    expect(conversation().getByText(/I lit up her unit on the map\./)).toBeTruthy();
    expect(api.calls.asked).toHaveLength(1);
    expect((box as HTMLTextAreaElement).value).toBe("Show them on the map");
  });

  test("two Enters in a row send one message", async () => {
    const api = scripted([{ ok: true, value: reply }]);
    render(<Harness api={api} />);
    openPanel();
    const box = screen.getByLabelText("Message Bärli");
    fireEvent.change(box, { target: { value: "glucose sensors" } });
    await act(async () => {
      fireEvent.keyDown(box, { key: "Enter" });
      fireEvent.keyDown(box, { key: "Enter" });
    });
    expect(api.calls.asked).toEqual([[{ role: "user", content: "glucose sensors" }]]);
    expect(screen.getAllByText("glucose sensors")).toHaveLength(1);
  });
});
