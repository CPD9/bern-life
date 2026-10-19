import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { parseSourcesList } from "./sources-list";
import type { SourcesOutcome } from "./sources-api";
import { SourcesApp } from "./sources-app";
import { queuedApi, sourcesBody } from "./testing";

function listed(): SourcesOutcome {
  const list = parseSourcesList(sourcesBody());
  if (!list) throw new Error("test body does not parse");
  return { status: "ok", list };
}

async function mount(outcomes: SourcesOutcome[], fixtureMode = false) {
  const api = queuedApi(outcomes);
  await act(async () => render(<SourcesApp fixtureMode={fixtureMode} api={api} />));
  return api;
}

describe("SourcesApp list", () => {
  test("each source shows its hosts as site links, kinds, counts and newest fetch in Bern", async () => {
    await mount([listed()]);
    expect(screen.getByText("demo-snapshot-1").parentElement?.textContent).toBe(
      "Snapshot demo-snapshot-1: 2 sources.",
    );
    const [first, second] = screen.getByRole("list", { name: "Sources" }).children;
    const links = within(screen.getByRole("list", { name: "Sites of Demo Institute" }))
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["www.demo-institute.test", "https://www.demo-institute.test/"],
      ["lab.demo-institute.test", "https://lab.demo-institute.test/"],
    ]);
    expect(first?.querySelector("dl")?.textContent).toBe(
      "Kindsperson, unitPages42Profiles17Newest page fetched19 Oct 2026",
    );
    expect(second?.querySelector("dl")?.textContent).toBe(
      "KindsnonePages0Profiles0Newest page fetchedNo pages in this snapshot",
    );
  });

  test("404 says the list is not connected yet, and the guide still shows", async () => {
    await mount([{ status: "not_connected" }]);
    expect(screen.getByText("The sources list is not connected yet.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How to add a source" })).toBeTruthy();
  });

  test("an error is a plain sentence; Try again asks once more", async () => {
    const api = await mount([{ status: "error" }, listed()]);
    expect(screen.getByText("The sources could not be loaded.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(api.calls()).toBe(2);
    expect(screen.getByRole("list", { name: "Sources" })).toBeTruthy();
  });

  test("Try again keeps focus in the app, on the status line", async () => {
    await mount([{ status: "error" }, listed()]);
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    await act(async () => {
      fireEvent.click(button);
    });
    const live = document.activeElement;
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe("Snapshot demo-snapshot-1: 2 sources.");
  });

  test("host links use the ink colour, which keeps 4.5:1 on the card in light and dark", async () => {
    await mount([listed()]);
    const link = screen.getByRole("link", { name: "calls.demo.test" });
    expect(link.className.split(" ")).toContain("text-ink");
    expect(link.className).not.toContain("text-primary");
  });

  test("fixture mode labels the list as invented", async () => {
    await mount([listed()], true);
    expect(screen.getByText("FIXTURE").parentElement?.textContent).toBe(
      "FIXTURE Invented sources and counts for the demo.",
    );
  });
});

describe("SourcesApp guide", () => {
  test("explains the file and steps, and offers no form", async () => {
    await mount([listed()]);
    expect(screen.getByText("Each entry in sites").nextElementSibling?.textContent).toBe(
      "Required: host, unit, seeds. Optional: allow_paths, deny_paths.",
    );
    expect(screen.getByText(/"id": "demo-institute"/)).toBeTruthy();
    expect(screen.getByText("python -m bernlife crawl --source demo-institute")).toBeTruthy();
    expect(document.querySelector("form, input, textarea")).toBeNull();
  });
});
