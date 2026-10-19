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

describe("LumiChat actions", () => {
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

  test("a reply that lands after the panel closed moves nothing", async () => {
    const shown: SearchResponse[] = [];
    const opened: string[] = [];
    const api = held();
    render(
      <Harness
        api={api}
        onShowOnMap={(response) => void shown.push(response)}
        onOpenProfile={(id) => void opened.push(id)}
      />,
    );
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    await closePanel();
    await act(async () => api.land({ ok: true, value: reply }));
    expect(shown).toEqual([]);
    expect(opened).toEqual([]);
  });
});

describe("LumiChat sending", () => {
  test("Enter pressed as a reply lands neither sends nor replaces the reply", async () => {
    const api = held();
    render(<Harness api={api} />);
    openPanel();
    await say("Who works on glucose sensors at DCB?");
    const box = screen.getByLabelText("Message Lumi");
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
    const box = screen.getByLabelText("Message Lumi");
    fireEvent.change(box, { target: { value: "glucose sensors" } });
    await act(async () => {
      fireEvent.keyDown(box, { key: "Enter" });
      fireEvent.keyDown(box, { key: "Enter" });
    });
    expect(api.calls.asked).toEqual([[{ role: "user", content: "glucose sensors" }]]);
    expect(screen.getAllByText("glucose sensors")).toHaveLength(1);
  });
});
