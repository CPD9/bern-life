import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PhoneHome, homeTiles } from "./phone-home";
import type { PhoneApp } from "./phone-types";

const app = (id: string, label: string, extra: Partial<PhoneApp> = {}): PhoneApp => ({
  id,
  label,
  icon: label.slice(0, 1),
  tile: "#0e7490",
  content: null,
  ...extra,
});

const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) =>
  app(`step-${number}`, `${number} Step`, {
    icon: String(number),
    folder: "The case",
    ...(number === 1 ? { folderHint: "Tap 1 and follow the steps." } : {}),
  }),
);
const apps: PhoneApp[] = [
  app("ask", "Ask", { dock: true }),
  app("library", "Library", { folder: "Work" }),
  app("settings", "Settings", { dock: true }),
  ...steps,
  app("sources", "Sources", { folder: "Work" }),
];

function renderHome() {
  const opened: string[] = [];
  render(<PhoneHome now={null} apps={apps} onOpen={(id) => opened.push(id)} />);
  return { opened };
}

const folderTile = (name: string) => screen.getByRole("button", { name: `${name} folder` });
const miniIcons = (tile: HTMLElement) =>
  Array.from(tile.querySelectorAll("[data-mini-icon]")).map((icon) =>
    icon.getAttribute("data-mini-icon"),
  );

describe("homeTiles", () => {
  test("a folder sits where its first app was and holds its apps in the order given", () => {
    expect(
      homeTiles(apps).map((tile) =>
        tile.kind === "app"
          ? tile.app.id
          : [tile.folder.name, tile.folder.hint, tile.folder.apps.map((member) => member.id)],
      ),
    ).toEqual([
      "ask",
      ["Work", undefined, ["library", "sources"]],
      "settings",
      ["The case", "Tap 1 and follow the steps.", steps.map((step) => step.id)],
    ]);
  });
});

describe("PhoneHome folders", () => {
  test("the grid shows one tile per folder, with up to nine mini icons in order", () => {
    renderHome();
    const grid = screen.getByRole("list", { name: "Apps" });
    expect(
      within(grid)
        .getAllByRole("button")
        .map((tile) => tile.getAttribute("aria-label")),
    ).toEqual(["Work folder", "The case folder"]);
    expect(miniIcons(folderTile("Work"))).toEqual(["library", "sources"]);
    expect(miniIcons(folderTile("The case"))).toEqual(steps.slice(0, 9).map((step) => step.id));
    expect(folderTile("The case").textContent).toBe("123456789The case");
    expect(folderTile("The case").getAttribute("aria-expanded")).toBe("false");
    expect(
      within(screen.getByRole("navigation", { name: "Dock" }))
        .getAllByRole("button")
        .map((tile) => tile.getAttribute("aria-label")),
    ).toEqual(["Ask", "Settings"]);
  });

  test("opening a folder shows its apps in order under its name and hint, focusing the first", () => {
    renderHome();
    fireEvent.click(folderTile("The case"));
    const panel = screen.getByRole("dialog", { name: "The case" });
    expect(panel.querySelector("p")?.textContent).toBe("Tap 1 and follow the steps.");
    expect(
      within(panel)
        .getAllByRole("button")
        .map((tile) => tile.getAttribute("aria-label")),
    ).toEqual(["Close", ...steps.map((step) => step.label)]);
    expect(document.activeElement).toBe(within(panel).getByRole("button", { name: "1 Step" }));
    expect(folderTile("The case").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("list", { name: "Apps" }).closest("[inert]")).not.toBeNull();
  });

  test("a folder without a hint shows none", () => {
    renderHome();
    fireEvent.click(folderTile("Work"));
    expect(screen.getByRole("dialog", { name: "Work" }).querySelector("p")).toBeNull();
  });

  test("tapping an app inside opens it", () => {
    const { opened } = renderHome();
    fireEvent.click(folderTile("The case"));
    fireEvent.click(screen.getByRole("button", { name: "3 Step" }));
    expect(opened).toEqual(["step-3"]);
  });

  test("Escape closes the folder and puts focus back on its tile", () => {
    renderHome();
    fireEvent.click(folderTile("Work"));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(folderTile("Work"));
    expect(screen.getByRole("list", { name: "Apps" }).closest("[inert]")).toBeNull();
  });

  test("the close control and a tap outside the panel close it too", () => {
    renderHome();
    fireEvent.click(folderTile("Work"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(folderTile("Work"));
    fireEvent.click(document.querySelector("[data-folder-backdrop]")!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(folderTile("Work"));
  });
});
