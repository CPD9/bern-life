import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AppEventName } from "@/infrastructure/app-events";
import { copyOf, passageFixture, resultFixture, viaFixture } from "@/test/fixtures";
import { ResultCard } from "./result-card";

const firstResult = () => copyOf(resultFixture.results[0]!);
const leadResult = () => copyOf(viaFixture.results[0]!);
const teamResult = () => copyOf(viaFixture.results[1]!);
const passageResult = () => copyOf(passageFixture.results[0]!);
const headings = () => screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);

describe("ResultCard", () => {
  test("shows exactly the fields that have claims", () => {
    render(<ResultCard result={firstResult()} />);
    const labels = Array.from(document.querySelectorAll("dt"), (dt) => dt.textContent);
    expect(labels).toEqual(["Role", "Unit", "Expertise", "Projects", "Infrastructure"]);
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

describe("ResultCard through a passage on its own page", () => {
  test("the passage comes before 'why it matches', labelled as a passage, not a claim", () => {
    render(<ResultCard result={passageResult()} />);
    expect(headings()).toEqual(["On their page", "Why it matches"]);
    expect(screen.getByText("“Ben Beispiel PhD student, sweat patches”")).toBeTruthy();
    expect(
      screen.getByText(/A passage next to the name on its own page, not a claim/),
    ).toBeTruthy();
    expect(screen.getByText("Role: PhD student")).toBeTruthy();
  });

  test("a reason that cites only the name is hidden; the passage still explains the result", () => {
    const result = passageResult();
    result.reason = { text: "Name: Ben Beispiel", cites: ["/name"] };
    render(<ResultCard result={result} />);
    expect(headings()).toEqual(["On their page"]);
    expect(screen.queryByText("Name: Ben Beispiel")).toBeNull();
  });
});
