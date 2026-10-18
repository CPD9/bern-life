import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AppEventName } from "@/infrastructure/app-events";
import { copyOf, resultFixture } from "@/test/fixtures";
import { ResultCard } from "./result-card";

const firstResult = () => copyOf(resultFixture.results[0]!);

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
