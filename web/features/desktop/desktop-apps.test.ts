import { expect, test } from "bun:test";
import { desktopApps } from "./desktop-apps";

test("the dock order and labels are fixed", () => {
  expect(desktopApps({}).map((app) => app.label)).toEqual([
    "Navigator",
    "Agents",
    "Reports",
    "Messages",
    "Library",
    "Opportunities",
    "Garage",
    "Settings",
  ]);
});

test("only the apps given content are wired", () => {
  const apps = desktopApps({ navigator: "ask here", settings: "toggles" });
  expect(apps.filter((app) => app.content !== null).map((app) => app.id)).toEqual([
    "navigator",
    "settings",
  ]);
  expect(apps.find((app) => app.id === "garage")?.content).toBeNull();
});
