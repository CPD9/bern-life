import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { copyOf, resultFixture } from "@/test/fixtures";
import type { ListedReport, ReportStore } from "./report-store";
import { ReportsApp } from "./reports-app";

/** Reports kept in memory; a blocked store refuses to remove them. */
function storeOf(listed: ListedReport[], { blocked = false } = {}): ReportStore {
  const kept = [...listed];
  return {
    save: () => null,
    load: () => null,
    list: () => [...kept],
    remove: (id) => {
      if (blocked) return false;
      kept.splice(
        kept.findIndex((report) => report.id === id),
        1,
      );
      return true;
    },
  };
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
      `${resultFixture.query}Sun 18 Oct 23:30Sample data`,
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

  test("Remove drops the shown report from this browser, then the next, then none is left", () => {
    const selected: string[] = [];
    const store = storeOf([newer, older]);
    render(
      <ReportsApp
        selectedId={null}
        onSelect={(id) => selected.push(id)}
        onAsk={() => undefined}
        store={store}
      />,
    );
    const remove = screen.getByRole("button", {
      name: `Remove the report on “${resultFixture.query}”`,
    });
    remove.focus();
    act(() => fireEvent.click(remove));
    expect(store.list()).toEqual([older]);
    expect(selected).toEqual(["old"]);
    expect(screen.getByRole("status").textContent).toBe(
      `Removed the report on “${resultFixture.query}”`,
    );
    // Remove now stands for the report shown next, and keeps the focus.
    const next = screen.getByRole("button", { name: "Remove the report on “Kunstherz”" });
    expect(document.activeElement).toBe(next);

    act(() => fireEvent.click(next));
    expect(store.list()).toEqual([]);
    expect(screen.getByRole("status").textContent).toBe("Removed the report on “Kunstherz”");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open the Navigator" }));
  });

  test("a report the browser will not remove stays, and the window says why", () => {
    const store = storeOf([newer], { blocked: true });
    render(
      <ReportsApp
        selectedId={null}
        onSelect={() => undefined}
        onAsk={() => undefined}
        store={store}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Remove the report on/ }));
    expect(store.list()).toEqual([newer]);
    expect(screen.getByRole("status").textContent).toBe(
      "This browser blocks storage, so the report could not be removed.",
    );
  });
});
