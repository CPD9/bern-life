import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AppEventName } from "@/infrastructure/app-events";
import { copyOf, resultFixture, viaFixture } from "@/test/fixtures";
import { CORRECTIONS_PATH } from "./claim-evidence";
import { ResultCard } from "./result-card";

const firstResult = () => copyOf(resultFixture.results[0]!);
const leadResult = () => copyOf(viaFixture.results[0]!);
const teamResult = () => copyOf(viaFixture.results[1]!);
const headings = () => screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);

describe("ResultCard", () => {
  test("shows exactly the fields that have claims", () => {
    render(<ResultCard result={firstResult()} />);
    const labels = Array.from(document.querySelectorAll("dt"), (dt) => dt.textContent);
    expect(labels).toEqual(["Role", "Unit", "Expertise", "Projects", "Infrastructure"]);
  });

  const fit = () => within(screen.getByRole("region", { name: "How well this result fits" }));
  const scores = () =>
    fit()
      .getAllByRole("listitem")
      .filter((li) => li.closest("ul")?.getAttribute("aria-label") === "Scores")
      .map((li) => li.textContent);
  const topics = () =>
    within(fit().getByRole("list", { name: "Topics" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
  const meters = () =>
    fit()
      .getAllByRole("meter")
      .map((meter) =>
        ["aria-label", "aria-valuenow", "aria-valuemax", "aria-valuetext"].map((name) =>
          meter.getAttribute(name),
        ),
      );

  test("three bars carry the engine's numbers exactly; confidence stays off while uncalibrated", () => {
    render(<ResultCard result={firstResult()} />);
    expect(scores()).toEqual(["Relevance100%", "Evidence100%", "Completeness5 of 5"]);
    expect(meters()).toEqual([
      ["Relevance", "1", "1", "100%"],
      ["Evidence", "1", "1", "100%"],
      ["Completeness", "5", "5", "5 of 5"],
    ]);
    expect(fit().queryByText(/calibrated/)).toBeNull();
  });

  test("covered topics are green check chips; what the result adds is one muted chip", () => {
    render(<ResultCard result={firstResult()} />);
    expect(topics()).toEqual(["✓ glucose sensors (found)", "New unit · Adds: glucose sensors"]);
    const [covered, novelty] = within(fit().getByRole("list", { name: "Topics" })).getAllByRole(
      "listitem",
    );
    expect(covered!.className).toContain("bg-primary");
    expect(novelty!.className).toContain("bg-chip");
  });

  test("the meanings fold away under one closed line, worded from the metrics module", () => {
    render(<ResultCard result={firstResult()} />);
    const details = fit().getByText("What do these mean?").closest("details")!;
    expect(details.open).toBe(false);
    expect(Array.from(details.querySelectorAll("li"), (li) => li.textContent)).toEqual([
      "Relevance: Share of your topics found in this result's verified claims",
      "Evidence: How directly the public pages tie this result to the topics",
      "Completeness: Profile fields the public pages fill, out of five",
    ]);
  });

  test("a value the engine could not compute is a dash with an empty track, never 0", () => {
    const result = firstResult();
    result.metrics = {
      ...result.metrics!,
      relevance: 0.5,
      covers: ["glucose sensors"],
      missing: ["sweat"],
      evidence: null,
      confidence: 0.734,
      novelty: { new_unit: false, adds: [] },
    };
    render(<ResultCard result={result} />);
    expect(scores()).toEqual(["Relevance50%", "Evidence—", "Completeness5 of 5", "Confidence73%"]);
    expect(meters()).toEqual([
      ["Relevance", "0.5", "1", "50%"],
      ["Completeness", "5", "5", "5 of 5"],
      ["Confidence", "0.734", "1", "73%"],
    ]);
    expect(topics()).toEqual(["✓ glucose sensors (found)", "sweat missing"]);
  });

  test("no topic chips at all when the result covers, misses and adds nothing", () => {
    const result = firstResult();
    result.metrics = {
      ...result.metrics!,
      covers: [],
      missing: [],
      novelty: { new_unit: false, adds: [] },
    };
    render(<ResultCard result={result} />);
    expect(fit().queryByRole("list", { name: "Topics" })).toBeNull();
  });

  test("a result the engine sent without metrics shows none", () => {
    render(<ResultCard result={leadResult()} />);
    expect(screen.queryByRole("region", { name: "How well this result fits" })).toBeNull();
  });

  test("a claim opens its span, page, fetch date and a link to the sentence", () => {
    render(<ResultCard result={firstResult()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Group Leader" })[0]!);
    expect(screen.getByText("“Group Leader, Sensor Lab”")).toBeTruthy();
    expect(screen.getByText(/fetched 18 Oct 2026/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open the page at this sentence" }).getAttribute("href"),
    ).toBe(
      "https://www.example-institute.test/team/ada-muster#:~:text=Group%20Leader%2C%20Sensor%20Lab",
    );
  });

  test("no fetch date is shown when the evidence has none", () => {
    const result = firstResult();
    delete result.profile.fields.role[0]!.evidence.fetched_at;
    render(<ResultCard result={result} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Group Leader" })[0]!);
    expect(screen.queryByText(/fetched/)).toBeNull();
  });

  test("the claims behind 'why it matches' are marked as cited", () => {
    render(<ResultCard result={firstResult()} />);
    const cited = screen.getAllByRole("button", { name: /\(cited\)$/ }).map((b) => b.textContent);
    expect(cited).toEqual([
      "continuous glucose monitoring (cited)",
      "wearable biosensors (cited)",
      "GlucoPatch (cited)",
      "continuous glucose monitoring (cited)",
      "wearable biosensors (cited)",
      "GlucoPatch (cited)",
    ]);
  });

  test("opening a claim's evidence is a story event; closing it is not", () => {
    const heard: AppEventName[] = [];
    render(
      <ResultCard result={firstResult()} events={{ emit: (name) => void heard.push(name) }} />,
    );
    const claim = screen.getAllByRole("button", { name: "Group Leader" })[0]!;
    fireEvent.click(claim);
    fireEvent.click(claim);
    expect(heard).toEqual(["evidence_opened"]);
  });
});

describe("ResultCard: correcting a sentence", () => {
  const note = () => screen.getByText("Wrong or outdated?").closest("details")!;

  test("an open claim says, folded away, how its sentence is corrected or removed", () => {
    render(<ResultCard result={firstResult()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Group Leader" })[0]!);
    expect(note().open).toBe(false);
    expect(note().textContent).toBe(
      "Wrong or outdated?This sentence is quoted from the institution's page as it read on 18 Oct 2026. A correction made on that page reaches Bern Life with the next snapshot; to ask for its removal from Bern Life, see Corrections and removal.",
    );
    const link = note().querySelector("a")!;
    expect([link.textContent, link.getAttribute("href")]).toEqual([
      "Corrections and removal",
      CORRECTIONS_PATH,
    ]);
    // The app's own page, so the link works wherever the app runs.
    expect(CORRECTIONS_PATH).toBe("/corrections");
    // It explains and links; it collects nothing and sends nothing.
    expect(note().querySelector("form, input, textarea, select, button")).toBeNull();
  });

  test("without a fetch date it says the page is quoted as stored", () => {
    const result = firstResult();
    delete result.profile.fields.role[0]!.evidence.fetched_at;
    render(<ResultCard result={result} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Group Leader" })[0]!);
    expect(note().textContent).toContain("from the institution's page as Bern Life stored it.");
  });

  test("the sentence that ties a result to a project says it too", () => {
    render(<ResultCard result={teamResult()} />);
    const through = screen.getByRole("region", { name: "Through the project PlateScan" });
    const notes = within(through).getAllByText("Wrong or outdated?");
    expect(notes).toHaveLength(1);
    // Under the relation sentence itself, before any of the project's claims is opened.
    const note = notes[0]!.closest("details")!;
    expect(note.parentElement!.textContent).toContain("“Project team: Lena Beispiel”");
    expect(note.textContent).toContain(
      "quoted from the institution's page as it read on 18 Oct 2026. A correction made on that page reaches Bern Life with the next snapshot;",
    );
  });
});

describe("ResultCard through a related project", () => {
  test("a result without via has no 'through' block", () => {
    render(<ResultCard result={firstResult()} />);
    expect(headings()).toEqual(["Why it matches"]);
  });

  test("the 'through' block comes before 'why it matches' and shows the relation sentence", () => {
    render(<ResultCard result={teamResult()} />);
    expect(headings()).toEqual(["Through the project PlateScan", "Why it matches"]);
    expect(screen.getByText("“Project team: Lena Beispiel”")).toBeTruthy();
    expect(screen.getByText(/Works on PlateScan according to this sentence\./)).toBeTruthy();
    expect(screen.getByText(/fetched 18 Oct 2026/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open the page at this sentence" }).getAttribute("href"),
    ).toBe(
      "https://www.example-institute.test/projects/platescan#:~:text=Project%20team%3A%20Lena%20Beispiel",
    );
  });

  test("the project's matching claims are shown as cited and open their own evidence", () => {
    render(<ResultCard result={teamResult()} />);
    fireEvent.click(screen.getByRole("button", { name: "carbohydrates from meal photos (cited)" }));
    expect(screen.getByText("“estimates carbohydrates from meal photos”")).toBeTruthy();
    expect(screen.getByText(/Proposed by Apertus/)).toBeTruthy();
  });

  test("a claim's button points at its evidence panel, not at the section heading", () => {
    render(<ResultCard result={teamResult()} />);
    const claim = screen.getByRole("button", { name: "carbohydrates from meal photos (cited)" });
    fireEvent.click(claim);
    const panel = document.getElementById(claim.getAttribute("aria-controls")!);
    expect(panel?.textContent).toContain("“estimates carbohydrates from meal photos”");
    const ids = Array.from(document.querySelectorAll("[id]"), (el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a reason that cites only the name is hidden; the relation still explains the result", () => {
    render(<ResultCard result={leadResult()} />);
    expect(headings()).toEqual(["Through the project PlateScan"]);
    expect(screen.queryByText("Name: Noah Exempel")).toBeNull();
    expect(screen.getByText(/Leads PlateScan according to this sentence\./)).toBeTruthy();
  });

  test("without a relation, a reason that cites only the name is still shown", () => {
    const result = leadResult();
    delete result.via;
    render(<ResultCard result={result} />);
    expect(headings()).toEqual(["Why it matches"]);
    expect(screen.getByText("Name: Noah Exempel")).toBeTruthy();
  });

  test("a related id of a kind the card does not know is named without a kind", () => {
    const result = teamResult();
    result.via!.related_profile_id = "call-example-meal-photos";
    result.via!.related_name = "Meal photos call";
    render(<ResultCard result={result} />);
    expect(headings()[0]).toBe("Through Meal photos call");
  });

  test("a related unit is named as a unit", () => {
    const result = teamResult();
    result.via!.related_profile_id = "unit-example-food-lab";
    result.via!.related_name = "Food Lab";
    render(<ResultCard result={result} />);
    expect(headings()[0]).toBe("Through the unit Food Lab");
  });
});
