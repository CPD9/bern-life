import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { parseNumbers } from "@/infrastructure/numbers";
import type { NumbersApi, NumbersOutcome } from "@/infrastructure/numbers-api";
import { numbersBody, queuedApi } from "@/test/numbers";
import { AgentsApp } from "./agents-app";
import { createLoopStore, type LoopStore } from "./loop-store";
import type { AgentNotice } from "./loops";
import type { Skill } from "./skills";
import { memoryStorage, responseWith } from "./testing";

type Answer = SearchResponse | "rate_limited" | null | Error;

/** A search that answers from a queue, in order, and records what it was asked. */
function fakeSearch(answers: Answer[]) {
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

/** Numbers that never arrive, for the loop tests: the skills stay on "Loading". */
const pending: NumbersApi = { numbers: () => new Promise(() => undefined) };

function setup(
  answers: Answer[],
  snapshot: string | null = "s1",
  store: LoopStore = createLoopStore(() => memoryStorage()),
  numbers: NumbersApi = pending,
  fixtureMode = false,
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
    numbers,
    fixtureMode,
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

const ENGINE: NumbersOutcome = { status: "ok", numbers: parseNumbers(numbersBody())! };

/** The Agents app once /api/numbers has answered with `outcome`. */
async function withNumbers(outcome: NumbersOutcome, fixtureMode = false) {
  const api = queuedApi([outcome]);
  let result: ReturnType<typeof setup> | undefined;
  await act(async () => {
    result = setup([], "s1", undefined, api, fixtureMode);
  });
  return { ...result!, api };
}

/** Each evidence row of a skill as [label, value, source]. */
function evidence(skill: string): (string | null)[][] {
  const list = screen.getByLabelText(`Evidence: ${skill}`);
  return Array.from(list.children).map((row) =>
    Array.from(row.children).map((cell) => cell.textContent),
  );
}

const RED_TEAM = [
  [
    "Apertus 70B: answers counted wrong, without and then with a system prompt that asks it to check the premise",
    "152 / 522 to 63 / 522",
    "Source: Apertus Red-Team Graph: technical report, Lessons Learnt; docs/audit/stats.json, mitigation",
  ],
  [
    "Apertus 8B: answers that confirmed made-up details about a private person",
    "15 / 18",
    "Source: Apertus Red-Team Graph: technical report, finding 2; docs/audit/stats.json, privacy_fabricated_person",
  ],
];

describe("AgentsApp skills", () => {
  test("lists the five real skills, Checks the premise second, and Try hands the skill over", async () => {
    const { tried, api } = await withNumbers(ENGINE);
    expect(api.calls()).toBe(1);
    expect(screen.getByRole("heading", { name: "Lumi’s skills" })).toBeTruthy();
    const names = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(names).toEqual([
      "Search people and units",
      "Checks the premise",
      "Read a project brief",
      "Make a match report",
      "Find opportunities",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Try Checks the premise" }));
    fireEvent.click(screen.getByRole("button", { name: "Try Read a project brief" }));
    expect(tried.map((skill) => skill.id)).toEqual(["premise", "brief"]);
  });

  test("Checks the premise shows the engine's numbers as sent, then the two red-team results", async () => {
    await withNumbers(ENGINE);
    const source = "Source: Bern Life’s evaluator on snapshot demo-snapshot-1, 48 queries";
    expect(evidence("Checks the premise")).toEqual([
      ["Invented questions abstained", "7 / 10", source],
      ["False abstentions", "2 / 38", source],
      ...RED_TEAM,
    ]);
    expect(evidence("Search people and units")).toEqual([
      ["Recall@10", "0.4375 [0.29, 0.58]", source],
      ["Traceable claims", "812 / 812", source],
    ]);
    const links = within(screen.getByLabelText("Evidence: Checks the premise")).getAllByRole(
      "link",
    );
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/api/numbers",
      "/api/numbers",
    ]);
  });

  test("under fixtures the numbers are marked FIXTURE and never called the evaluator's", async () => {
    await withNumbers(ENGINE, true);
    const source = "Source: Invented for the demo (DEMO_FIXTURES), not from the evaluator";
    expect(evidence("Checks the premise")).toEqual([
      ["Invented questions abstained", "FIXTURE 7 / 10", source],
      ["False abstentions", "FIXTURE 2 / 38", source],
      ...RED_TEAM,
    ]);
    expect(document.body.textContent).not.toMatch(/evaluator on snapshot/);
  });

  test("without the numbers the quoted results stay and a note says why", async () => {
    await withNumbers({ status: "not_connected" });
    expect(evidence("Checks the premise")).toEqual(RED_TEAM);
    const card = screen.getByRole("heading", { name: "Checks the premise" }).closest("li")!;
    expect(within(card).getByText("Bern Life’s numbers are not connected yet.")).toBeTruthy();
    expect(screen.queryByLabelText("Evidence: Search people and units")).toBeNull();
  });

  test("a skill with no number behind it says so and shows no row", async () => {
    await withNumbers(ENGINE);
    for (const name of ["Read a project brief", "Make a match report", "Find opportunities"]) {
      const card = screen.getByRole("heading", { name }).closest("li")!;
      expect(within(card).getByText("No numbers back this skill yet.")).toBeTruthy();
      expect(screen.queryByLabelText(`Evidence: ${name}`)).toBeNull();
    }
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

  test("a search over the limit says to wait, not to try again now", async () => {
    const { store, notices } = setup([responseWith("s1", [["a", "unit"]]), "rate_limited"]);
    saveLoop("insulin pumps");
    await runNow("insulin pumps");
    const before = store.get();
    await runNow("insulin pumps");
    expect(screen.getByRole("alert").textContent).toBe(
      "Too many requests from here right now; try again in a few minutes.",
    );
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
