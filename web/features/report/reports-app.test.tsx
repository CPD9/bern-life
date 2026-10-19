import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { copyOf, resultFixture } from "@/test/fixtures";
import type { ListedReport, ReportStore } from "./report-store";
import { ReportsApp } from "./reports-app";

function storeOf(listed: ListedReport[]): ReportStore {
  return { save: () => null, load: () => null, list: () => listed };
}

const newer: ListedReport = {
  id: "new",
  report: { response: resultFixture, madeAt: "2026-10-18T21:30:00Z", fixture: true },
};
const older: ListedReport = {
  id: "old",
  report: {
    response: { ...copyOf(resultFixture), query: "Kunstherz" },
    madeAt: "2026-10-18T19:05:00Z",
    fixture: false,
  },
};

describe("ReportsApp", () => {
  test("no reports yet points to the Navigator", () => {
    const onAsk = mock(() => undefined);
    render(
      <ReportsApp selectedId={null} onSelect={() => undefined} onAsk={onAsk} store={storeOf([])} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open the Navigator" }));
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  test("lists the reports with their time and shows the newest by default", () => {
    render(
      <ReportsApp
        selectedId={null}
        onSelect={() => undefined}
        onAsk={() => undefined}
        store={storeOf([newer, older])}
      />,
    );
    const reports = within(screen.getByRole("navigation", { name: "Your reports" }));
    const items = reports.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      `${resultFixture.query}Sun 18 Oct 23:30FIXTURE`,
      "KunstherzSun 18 Oct 21:05",
    ]);
    expect(screen.getByText("Ada Muster")).toBeTruthy();
    const current = screen.getByRole("button", { current: true });
    expect(current.textContent).toContain(resultFixture.query);
    expect(
      screen.getByRole("link", { name: "Open as a page to save as PDF" }).getAttribute("href"),
    ).toBe("/report/new");
  });

  test("choosing a report selects it", () => {
    const selected: string[] = [];
    render(
      <ReportsApp
        selectedId="old"
        onSelect={(id) => selected.push(id)}
        onAsk={() => undefined}
        store={storeOf([newer, older])}
      />,
    );
    expect(screen.getByRole("button", { current: true }).textContent).toContain("Kunstherz");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(resultFixture.query) }));
    expect(selected).toEqual(["new"]);
  });
});
