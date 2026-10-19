import { describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { parseNumbers } from "@/infrastructure/numbers";
import type { NumbersOutcome } from "@/infrastructure/numbers-api";
import { numbersBody, queuedApi } from "@/test/numbers";
import { GarageApp } from "./garage-app";

function measured(body: unknown = numbersBody()): NumbersOutcome {
  const numbers = parseNumbers(body);
  if (!numbers) throw new Error("test body does not parse");
  return { status: "ok", numbers };
}

async function mount(outcomes: NumbersOutcome[], fixtureMode = false) {
  const api = queuedApi(outcomes);
  const events: string[] = [];
  const props = {
    fixtureMode,
    api,
    onVisited: () => void events.push("visited"),
    onNumbersSeen: () => void events.push("numbers_seen"),
  };
  const view = await act(async () => render(<GarageApp {...props} />));
  const rerender = () =>
    view.rerender(<GarageApp {...props} onVisited={() => events.push("visited")} />);
  return { api, events, rerender };
}

function stat(label: string): string | null | undefined {
  const term = screen.getByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent;
}

describe("GarageApp numbers", () => {
  test("shows each measured number exactly, with its interval and n of total", async () => {
    await mount([measured()]);
    expect(stat("Recall@10")).toBe("0.4375 [0.29, 0.58]");
    expect(stat("MRR")).toBe("0.31");
    expect(stat("Traceable claims")).toBe("812 / 812");
    expect(stat("Invented questions abstained")).toBe("7 / 10");
    expect(stat("False abstentions")).toBe("2 / 38");
    expect(stat("Invented entities")).toBe("0");
    expect(stat("en")).toBe("0.5");
    expect(stat("de")).toBe("0.25 [0.05, 0.5]");
    expect(screen.getByText("Measured by the evaluator on 48 queries.")).toBeTruthy();
    expect(screen.getByText("Mon 19 Oct 00:30")).toBeTruthy();
  });

  test("lists every model with calls, ok and latency in milliseconds", async () => {
    await mount([measured()]);
    const cards = within(screen.getByRole("list", { name: "Models by role" })).getAllByRole(
      "listitem",
    );
    expect(cards.map((card) => card.textContent)).toEqual([
      "expanddemo-model-largeCalls120OK118Median latency584 msp95 latency1210.5 ms",
      "briefdemo-model-smallCalls0OK0Median latencynot recordedp95 latencynot recorded",
    ]);
  });

  test("eval null says the evaluator has not run, and the models still show", async () => {
    await mount([measured({ ...numbersBody(), eval: null })]);
    expect(screen.getByText("The evaluator has not run on this snapshot.")).toBeTruthy();
    expect(screen.queryByText("Recall@10")).toBeNull();
    expect(screen.getByRole("list", { name: "Models by role" })).toBeTruthy();
  });

  test("404 says the numbers are not connected yet, with no retry", async () => {
    await mount([{ status: "not_connected" }]);
    expect(screen.getByText("The numbers are not connected yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("an error is a plain sentence; Try again asks once more", async () => {
    const { api } = await mount([{ status: "error" }, measured()]);
    expect(screen.getByText("The numbers could not be loaded.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(api.calls()).toBe(2);
    expect(stat("Recall@10")).toBe("0.4375 [0.29, 0.58]");
  });

  test("one query is written in the singular, measured or made up", async () => {
    const body = numbersBody();
    const single = { ...body, eval: { ...body.eval, queries: 1 } };
    await mount([measured(single)]);
    expect(screen.getByText("Measured by the evaluator on 1 query.")).toBeTruthy();
    cleanup();
    await mount([measured(single)], true);
    expect(screen.getByText("1 query, made up for the demo.")).toBeTruthy();
  });

  test("Try again keeps focus in the garage, on the status line", async () => {
    await mount([{ status: "error" }, { status: "error" }]);
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    await act(async () => {
      fireEvent.click(button);
    });
    const live = document.activeElement;
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe("The numbers could not be loaded.Try again");
  });

  test("fixture mode labels the numbers as invented and never calls them measured", async () => {
    await mount([measured()], true);
    expect(screen.getByText("Sample data.").parentElement?.textContent).toBe(
      "Sample data. Invented numbers for the demo, not from the evaluator or the search service.",
    );
    expect(screen.getByText("48 queries, made up for the demo.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/measured/i);
  });
});

describe("GarageApp events", () => {
  test("visited fires once on mount, not again on rerender; numbers seen fires once", async () => {
    const { events, rerender } = await mount([measured()]);
    rerender();
    rerender();
    expect(events).toEqual(["visited", "numbers_seen"]);
  });

  test("numbers seen waits for real numbers: not in fixture mode", async () => {
    const { events } = await mount([measured()], true);
    expect(events).toEqual(["visited"]);
  });

  test("numbers seen does not fire when the evaluator has not run", async () => {
    const { events } = await mount([measured({ ...numbersBody(), eval: null })]);
    expect(events).toEqual(["visited"]);
  });

  test("numbers seen does not fire on 404 or an error, and fires once after a good retry", async () => {
    const missing = await mount([{ status: "not_connected" }]);
    expect(missing.events).toEqual(["visited"]);
    const failed = await mount([{ status: "error" }, measured()]);
    expect(failed.events).toEqual(["visited"]);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0] as HTMLElement);
    });
    expect(failed.events).toEqual(["visited", "numbers_seen"]);
  });
});
