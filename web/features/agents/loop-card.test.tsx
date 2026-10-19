import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { LoopCard } from "./loop-card";
import { type Loop, makeLoop, recordRun } from "./loops";
import type { RunStatus } from "./use-loops";
import { responseWith } from "./testing";

function saved(): Loop {
  const loop = makeLoop("insulin pumps", []);
  if (loop === null) throw new Error("invalid loop");
  return loop;
}

function renderCard(first: Loop, status?: RunStatus) {
  let runs = 0;
  const card = (loop: Loop, now?: RunStatus) => (
    <ul>
      <LoopCard
        loop={loop}
        status={now}
        snapshot="s1"
        onRun={() => void (runs += 1)}
        onRemove={() => {}}
      />
    </ul>
  );
  const view = render(card(first, status));
  return {
    runs: () => runs,
    rerender: (loop: Loop, now?: RunStatus) => view.rerender(card(loop, now)),
  };
}

const people = (snapshot: string, ids: string[], mode?: SearchResponse["mode"]) =>
  responseWith(
    snapshot,
    ids.map((id) => [id, "person"] as const),
    mode,
  );

describe("LoopCard", () => {
  test("while running, the button is named as it reads and stays focusable but inert", () => {
    const { runs } = renderCard(saved(), "running");
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Running…: insulin pumps",
    });
    expect([button.textContent, button.getAttribute("aria-disabled")]).toEqual([
      "Running…",
      "true",
    ]);
    fireEvent.click(button);
    expect(runs()).toBe(0);
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  test("Run now runs when idle", () => {
    const { runs } = renderCard(saved());
    fireEvent.click(screen.getByRole("button", { name: "Run now: insulin pumps" }));
    expect(runs()).toBe(1);
  });

  test("each finished run is announced in a polite live region", () => {
    const loop = saved();
    const { rerender } = renderCard(loop);
    const region = screen.getByRole("status");
    expect([region.getAttribute("aria-live"), region.textContent]).toEqual(["polite", ""]);
    const first = recordRun(loop, people("s1", ["a", "b"]));
    rerender(first);
    expect(region.textContent).toBe("Ran on snapshot s1. The next run lists what changed.");
    rerender(recordRun(first, people("s1", ["b", "c"])));
    expect(region.textContent).toBe("Ran on snapshot s1: 1 new, 1 dropped.");
  });

  test("runs that read the same are each announced with new content", () => {
    let loop = saved();
    const { rerender } = renderCard(loop);
    const region = screen.getByRole("status");
    const observer = new MutationObserver(() => {});
    observer.observe(region, { childList: true, subtree: true, characterData: true });
    const added: string[] = [];
    for (let run = 0; run < 3; run += 1) {
      loop = recordRun(loop, people("s1", ["a"]));
      rerender(loop);
      added.push(
        observer
          .takeRecords()
          .flatMap((record) => [...record.addedNodes].map((node) => node.textContent))
          .join(""),
      );
    }
    observer.disconnect();
    expect(added).toEqual([
      "Ran on snapshot s1. The next run lists what changed.",
      "Ran on snapshot s1: nothing new or dropped.",
      "Ran on snapshot s1: nothing new or dropped.",
    ]);
  });

  test("a loop shown again after a reload announces nothing", () => {
    renderCard(recordRun(saved(), people("s1", ["a"])));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("a MOCK run after a replay run lists no changes and says why", () => {
    const first = recordRun(saved(), people("s1", ["a"]));
    const { rerender } = renderCard(first);
    rerender(recordRun(first, people("fixture", ["b"], "mock")));
    expect(screen.getByRole("status").textContent).toBe(
      "Ran on snapshot fixture (MOCK). The run before was not MOCK, so the two were not compared; the next run compares with this one.",
    );
    expect(screen.queryByRole("list", { name: "Changes since the run before" })).toBeNull();
    expect(screen.getByText("MOCK")).toBeTruthy();
  });
});
