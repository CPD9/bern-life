import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { copyOf, resultFixture } from "@/test/fixtures";
import { ReportDocument } from "./report-document";
import { legendRules } from "./report-legend";
import { buildReport } from "./report-model";

function renderReport(response = resultFixture) {
  render(<ReportDocument report={buildReport(response, "2026-10-18T19:30:00Z", true)!} />);
}

test("the legend prints all five rules and the ordering line is above the matches", () => {
  renderReport();
  const legend = screen.getByRole("heading", { name: "How to read this report" }).parentElement!;
  expect(
    within(legend)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([...legendRules]);
  expect(
    screen.getByText(
      "Ordered by search match · the numbers describe each result, they don't rank it.",
    ),
  ).toBeTruthy();
});

test("found topics are filled chips and missing ones are marked not found", () => {
  const response = copyOf(resultFixture);
  response.results[0]!.metrics!.missing = ["children"];
  renderReport(response);
  const chips = screen.getByRole("list", { name: "Topics" });
  expect(
    within(chips)
      .getAllByRole("listitem")
      .map((chip) => chip.textContent),
  ).toEqual(["✓ glucose sensors (found)", "children (not found)"]);
});

test("the proof sentence marks the topic words and links to the sentence on the page", () => {
  renderReport();
  expect(
    Array.from(document.querySelectorAll("blockquote mark"), (mark) => mark.textContent),
  ).toEqual(["continuous glucose monitoring"]);
  expect(
    screen
      .getByRole("link", { name: "www.example-institute.test/team/ada-muster" })
      .getAttribute("href"),
  ).toBe(
    "https://www.example-institute.test/team/ada-muster#:~:text=continuous%20glucose%20monitoring",
  );
});

test("the footer names the snapshot and the mode", () => {
  renderReport();
  expect(document.querySelector("footer")!.textContent).toContain("Snapshot fixture");
  expect(document.querySelector("footer")!.textContent).toContain("MOCK · FIXTURE");
});

test("each quote says how to correct it on screen, and the legend says so on paper", () => {
  renderReport();
  const note = screen.getByText("Wrong or outdated?").closest("details")!;
  expect(note.parentElement!.className).toContain("print:hidden");
  // Outside the quote's figure, whose caption stays its last child.
  expect(note.closest("figure")).toBeNull();
  expect(document.querySelector("figure")!.lastElementChild!.tagName).toBe("FIGCAPTION");
  expect(note.textContent).toContain("as it read on 18 Oct 2026");
  const legend = screen.getByRole("heading", { name: "How to read this report" }).parentElement!;
  expect(legend.textContent).toContain(
    "To ask for a quote to be removed from Bern Life, see /corrections.",
  );
});
