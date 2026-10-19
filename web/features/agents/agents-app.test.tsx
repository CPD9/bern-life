import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AgentsApp } from "./agents-app";
import { createLoopStore, type LoopStore } from "./loop-store";
import type { AgentNotice } from "./loops";
import type { Skill } from "./skills";
import { memoryStorage, responseWith } from "./testing";

/** A search that answers from a queue, in order, and records what it was asked. */
function fakeSearch(answers: (SearchResponse | null | Error)[]) {
  const queries: string[] = [];
  const search = async (query: string) => {
    queries.push(query);
    const answer = answers.shift();
    if (answer === undefined) throw new Error("no answer queued");
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { search, queries };
}

function setup(
  answers: (SearchResponse | null | Error)[],
  snapshot: string | null = "s1",
  store: LoopStore = createLoopStore(() => memoryStorage()),
) {
  const { search, queries } = fakeSearch(answers);
  const notices: AgentNotice[] = [];
  const tried: Skill[] = [];
  const props = {
    agent: { name: "Lumi" },
    search,
    onTrySkill: (skill: Skill) => void tried.push(skill),
    notify: (notice: AgentNotice) => void notices.push(notice),
    store,
  };
  const view = render(<AgentsApp {...props} snapshot={snapshot} />);
  const rerender = (next: string | null) => view.rerender(<AgentsApp {...props} snapshot={next} />);
  return { queries, notices, tried, store, rerender };
}

function saveLoop(query: string, kinds: string[] = []) {
  fireEvent.change(screen.getByLabelText("Search to keep"), { target: { value: query } });
  for (const kind of kinds) fireEvent.click(screen.getByLabelText(kind));
  fireEvent.click(screen.getByRole("button", { name: "Save loop" }));
}

async function runNow(query: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: `Run now: ${query}` }));
  });
}

describe("AgentsApp skills", () => {
  test("lists the four real skills and Try hands the skill to the host", () => {
    const { tried } = setup([]);
    expect(screen.getByRole("heading", { name: "Lumi’s skills" })).toBeTruthy();
    const names = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(names).toEqual([
      "Search people and units",
      "Read a project brief",
      "Make a match report",
      "Find opportunities",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Try Read a project brief" }));
    expect(tried.map((skill) => skill.id)).toEqual(["brief"]);
  });
});

describe("AgentsApp loops", () => {
  test("a saved loop shows its kinds and that it has not run; saving it again says so", () => {
    setup([]);
    expect(screen.getByText("No loops yet.")).toBeTruthy();
    saveLoop("insulin pumps", ["Units", "Funding calls"]);
    const card = within(screen.getByRole("list", { name: "Saved loops" })).getByRole("listitem");
    expect(within(card).getByText("Units, Funding calls")).toBeTruthy();
    expect(within(card).getByText("Not run yet.")).toBeTruthy();
    expect(screen.getByText("Saved. Run it now to set the first results.")).toBeTruthy();
    saveLoop("Insulin  pumps", ["Funding calls", "Units"]);
    expect(screen.getByText("This loop is already saved.")).toBeTruthy();
  });

  test("the first run sets the baseline; the next one lists and notifies changes", async () => {
    const first = responseWith("s1", [
      ["a", "person"],
      ["b", "unit"],
    ]);
    const second = responseWith("s2", [
      ["b", "unit"],
      ["c", "person"],
    ]);
    const { queries, notices, rerender } = setup([first, second]);
    saveLoop("insulin pumps");
    await runNow("insulin pumps");
    expect(queries).toEqual(["insulin pumps"]);
    expect(screen.getByText("Last ran on snapshot s1: 2 results.")).toBeTruthy();
    expect(notices).toEqual([]);

    rerender("s2");
    expect(screen.getByText("New snapshot: run again")).toBeTruthy();
    await runNow("insulin pumps");
    expect(screen.queryByText("New snapshot: run again")).toBeNull();
    expect(screen.getByText("Last ran on snapshot s2: 2 results.")).toBeTruthy();
    const changes = screen.getByRole("list", { name: "Changes since the run before" });
    expect(
      within(changes)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["New: Name c", "Dropped: Name a"]);
    expect(within(changes).getByRole("link", { name: "Name c" }).getAttribute("href")).toBe(
      "https://www.example-institute.test/c",
    );
    expect(notices).toEqual([
      {
        title: "New in “insulin pumps”",
        body: "Name c (person) is a new result on snapshot s2.",
        href: "https://www.example-institute.test/c",
      },
      {
        title: "Dropped from “insulin pumps”",
        body: "Name a (person) is no longer a result on snapshot s2.",
        href: "https://www.example-institute.test/a",
      },
    ]);
  });

  test("a loop narrowed to kinds ignores results of other kinds", async () => {
    const { notices } = setup([
      responseWith("s1", [["a", "unit"]]),
      responseWith("s1", [
        ["a", "unit"],
        ["p", "person"],
      ]),
    ]);
    saveLoop("insulin pumps", ["Units"]);
    await runNow("insulin pumps");
    await runNow("insulin pumps");
    expect(screen.getByText("No new or dropped results since the run before.")).toBeTruthy();
    expect(notices).toEqual([]);
  });

  test("a failed search keeps the last run and says to try again", async () => {
    const { store, notices } = setup([responseWith("s1", [["a", "unit"]]), new Error("down")]);
    saveLoop("insulin pumps");
    await runNow("insulin pumps");
    const before = store.get();
    await runNow("insulin pumps");
    expect(screen.getByRole("alert").textContent).toBe("The search did not answer. Try again.");
    expect(store.get()).toBe(before);
    expect(notices).toEqual([]);
  });

  test("a mock answer is marked MOCK and a removed loop is gone", async () => {
    setup([responseWith("fixture", [["a", "unit"]], "mock")], "fixture");
    saveLoop("insulin pumps");
    await runNow("insulin pumps");
    expect(screen.getByText("MOCK")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove loop: insulin pumps" }));
    expect(screen.getByText("No loops yet.")).toBeTruthy();
  });

  test("loops saved in an earlier visit are shown again", () => {
    const storage = memoryStorage();
    setup(
      [],
      "s1",
      createLoopStore(() => storage),
    );
    saveLoop("insulin pumps");
    setup(
      [],
      "s1",
      createLoopStore(() => storage),
    );
    expect(screen.getAllByRole("heading", { name: "insulin pumps" })).toHaveLength(2);
  });
});
