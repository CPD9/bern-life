import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import activityBody from "../../../contracts/fixtures/admin-activity.json";
import flaggedBody from "../../../contracts/fixtures/admin-flagged.json";
import healthBody from "../../../contracts/fixtures/health.json";
import sourcesBody from "../../../contracts/fixtures/sources.json";
import {
  parseAdminActivity,
  parseAdminFlagged,
  parseHealth,
  parseSourcesList,
} from "@/infrastructure/contract";
import type { AdminApi, AdminOutcome } from "./admin-api";
import { AdminApp } from "./admin-app";
import { budgetText, formatUptime, outcomeText } from "./admin-text";

function parsed<T>(value: T | null): T {
  if (value === null) throw new Error("fixture does not match its schema");
  return value;
}

const activity = parsed(parseAdminActivity(activityBody));
const flagged = parsed(parseAdminFlagged(flaggedBody));
const health = parsed(parseHealth(healthBody));
const sources = parsed(parseSourcesList(sourcesBody));

type Answers = {
  health?: AdminOutcome<typeof health>;
  sources?: AdminOutcome<typeof sources>;
  activity?: AdminOutcome<typeof activity>;
  flagged?: AdminOutcome<typeof flagged>;
};

/** Answers every read from `answers`, the fixtures by default, and counts the reads per route. */
function fakeApi(answers: Answers = {}): AdminApi & { calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const answer =
    <T,>(route: string, fallback: T, given: AdminOutcome<T> | undefined) =>
    async () => {
      calls[route] = (calls[route] ?? 0) + 1;
      return given ?? { status: "ok" as const, value: fallback };
    };
  return {
    calls,
    health: answer("health", health, answers.health),
    sources: answer("sources", sources, answers.sources),
    activity: answer("activity", activity, answers.activity),
    flagged: answer("flagged", flagged, answers.flagged),
  };
}

async function mount(api: AdminApi, fixtureMode = false) {
  await act(async () => render(<AdminApp fixtureMode={fixtureMode} api={api} />));
}

async function openData() {
  await act(async () => {
    fireEvent.click(screen.getByRole("tab", { name: "Data" }));
  });
  return screen.getByRole("tabpanel");
}

const texts = (nodes: HTMLElement[]) => nodes.map((node) => node.textContent);

describe("AdminApp Operations", () => {
  test("engine mode, status and counts, each with its unit", async () => {
    await mount(fakeApi());
    const engine = screen.getByRole("region", { name: "Engine" });
    expect(within(engine).getByText("OK")).toBeTruthy();
    expect(
      within(engine).getByText("Mock: no model is connected, so the UI shows MOCK."),
    ).toBeTruthy();
    expect(engine.querySelector("dl")?.textContent).toBe(
      "SnapshotfixturePages2Profiles2Up forunknown",
    );
  });

  test("today's live calls against the budget, with a meter", async () => {
    await mount(fakeApi());
    const live = screen.getByRole("region", { name: "Live calls today" });
    expect(within(live).getByText("3 of 50 live calls used today (UTC), 47 left.")).toBeTruthy();
    const meter = within(live).getByRole("meter", { name: "Live calls used today" });
    expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual([
      "3",
      "50",
    ]);
  });

  test("calls per day as a bar list, newest first, each day's outcomes in words", async () => {
    await mount(fakeApi());
    const list = screen.getByRole("list", { name: "Model calls per day" });
    const days = within(list).getAllByRole("listitem");
    expect(days.map((day) => day.querySelector("span")?.textContent)).toEqual(["19 Oct", "18 Oct"]);
    expect(texts(days.map((day) => day.querySelectorAll("span")[1] as HTMLElement))).toEqual([
      "12 calls",
      "40 calls",
    ]);
    expect(texts(days.map((day) => day.querySelector("p") as HTMLElement))).toEqual([
      "8 from the cache, 3 live, 1 failed",
      "31 from the cache, 9 live",
    ]);
    const meters = within(list).getAllByRole("meter");
    expect(meters.map((meter) => meter.getAttribute("aria-valuenow"))).toEqual(["12", "40"]);
    expect(meters.map((meter) => meter.getAttribute("aria-valuemax"))).toEqual(["40", "40"]);
    expect(
      screen.getByRole("region", { name: "Failed calls by marker" }).querySelector("dl")
        ?.textContent,
    ).toBe("timeout1");
  });

  test("an empty audit says why the list is empty, and a replay engine why nothing is spent", async () => {
    const quiet = { ...activity, live_today: 0, budget: null, days: [], failures: {} };
    await mount(fakeApi({ activity: { status: "ok", value: quiet } }));
    expect(
      screen.getByText(
        "No model calls recorded on this machine yet. The engine writes one line per model call to its audit; this list fills with the first call.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("No live budget: the engine is not live, so nothing can be spent today."),
    ).toBeTruthy();
    expect(screen.getByText("No model call failed on these days.")).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  test("the sentences behind the numbers", () => {
    expect(budgetText({ ...activity, budget: { limit: 50, used: 50 } })).toBe(
      "50 of 50 live calls used today (UTC), 0 left.",
    );
    expect(budgetText({ ...activity, budget: null, live_today: 2 })).toBe(
      "No live budget now, but the audit shows 2 calls reached a model today.",
    );
    expect(outcomeText({ hit: 2, miss: 1, budget: 1, http_504: 2, other: 1 })).toBe(
      "2 from the cache, 2 not answered, 3 failed",
    );
    expect([formatUptime(59), formatUptime(3_660), formatUptime(90_000)]).toEqual([
      "0 minutes",
      "1 hour 1 minute",
      "25 hours 0 minutes",
    ]);
  });
});

describe("AdminApp Data", () => {
  test("each source with profiles, pages, sites and the newest fetch in Bern", async () => {
    await mount(fakeApi());
    const panel = await openData();
    const cards = within(within(panel).getByRole("list", { name: "Sources" })).getAllByRole(
      "listitem",
    );
    expect(texts(cards.map((card) => card.querySelector("h4") as HTMLElement))).toEqual([
      "Example Institute (fixture, not a real site)",
      "Example Clinic (fixture, not a real site)",
      "Example Foundation (fixture, not a real site)",
    ]);
    expect(cards[0]?.querySelector("dl")?.textContent).toBe(
      "Profiles63Pages48Sites1Newest page fetched18 Oct 2026",
    );
    expect(cards[2]?.querySelector("dl")?.textContent).toBe(
      "Profiles0Pages0Sites1Newest page fetchedNo pages in this snapshot",
    );
  });

  test("the names to check, each with its reason, source and a link to its page", async () => {
    await mount(fakeApi());
    const panel = await openData();
    expect(
      within(panel).getByText(
        "2 of 63 person profiles have a name shaped like a company or group. Open the page and check who it names.",
      ),
    ).toBeTruthy();
    const rows = within(within(panel).getByRole("list", { name: "Names to check" })).getAllByRole(
      "listitem",
    );
    expect(texts(rows.map((row) => row.querySelector("span span") as HTMLElement))).toEqual([
      "Sample Health",
      "Example Digital",
    ]);
    expect(rows[0]?.querySelectorAll("span")[2]?.textContent).toBe(
      "ends in Health · Example Clinic (fixture, not a real site)",
    );
    const links = within(panel).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Open page of Sample Health", "https://www.example-clinic.test/challenge/finalists"],
      ["Open page of Example Digital", "https://www.example-institute.test/partners"],
    ]);
    expect(links.every((link) => link.getAttribute("rel") === "noopener noreferrer")).toBe(true);
  });

  test("no flagged name says so with the number checked", async () => {
    await mount(fakeApi({ flagged: { status: "ok", value: { ...flagged, people: [] } } }));
    const panel = await openData();
    expect(
      within(panel).getByText(
        "No person profile has a name shaped like a company. Checked 63 person profiles.",
      ),
    ).toBeTruthy();
    expect(within(panel).queryByRole("list", { name: "Names to check" })).toBeNull();
  });
});

describe("AdminApp gate and states", () => {
  test("a member sees one sentence on each tab and no Try again", async () => {
    await mount(fakeApi({ activity: { status: "forbidden" }, flagged: { status: "forbidden" } }));
    const refused = "This account is not an admin, so the admin routes refused it.";
    expect(screen.getByText(refused)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    const panel = await openData();
    expect(within(panel).getByText(refused)).toBeTruthy();
  });

  test("signed out and not connected are told apart", async () => {
    await mount(
      fakeApi({ activity: { status: "signed_out" }, flagged: { status: "not_connected" } }),
    );
    expect(
      screen.getByText(
        "You are signed out. Sign in as the admin account to see operations and data.",
      ),
    ).toBeTruthy();
    const panel = await openData();
    expect(within(panel).getByText("The admin routes are not connected yet.")).toBeTruthy();
  });

  test("an error offers Try again, which asks every route once more", async () => {
    const api = fakeApi({ activity: { status: "error" } });
    await mount(api);
    expect(screen.getByText("The figures could not be loaded.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(api.calls).toEqual({ health: 2, sources: 2, activity: 2, flagged: 2 });
  });

  test("the tabs follow the arrow keys and the panel is labelled by the selected tab", async () => {
    await mount(fakeApi());
    const operations = screen.getByRole("tab", { name: "Operations" });
    operations.focus();
    await act(async () => {
      fireEvent.keyDown(operations, { key: "ArrowRight" });
    });
    const data = screen.getByRole("tab", { name: "Data" });
    expect(data.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(data.id);
    expect(screen.getByRole("region", { name: "Sources" })).toBeTruthy();
  });

  test("fixture mode labels the figures as invented", async () => {
    await mount(fakeApi(), true);
    expect(screen.getByText("Sample data.").parentElement?.textContent).toBe(
      "Sample data. Invented figures for the demo.",
    );
  });
});
