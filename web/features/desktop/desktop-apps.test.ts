import { expect, test } from "bun:test";
import { desktopApps } from "./desktop-apps";

const everyApp = {
  navigator: "ask",
  agents: "skills",
  reports: "reports",
  messages: "threads",
  library: "saved",
  opportunities: "calls",
  garage: "models",
  settings: "toggles",
};

test("the dock order and labels are fixed", () => {
  expect(desktopApps(everyApp).map((app) => app.label)).toEqual([
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

test("an app with no content is gone from the dock, not shown as a sheet", () => {
  const apps = desktopApps({ navigator: "ask here", garage: null, settings: "toggles" });
  expect(apps.map((app) => app.id)).toEqual(["navigator", "settings"]);
  expect(desktopApps({})).toEqual([]);
});

test("a badge is kept only when there is something to count", () => {
  const apps = desktopApps(
    { navigator: "ask", messages: "threads" },
    { messages: 3, navigator: 0 },
  );
  expect(apps.map((app) => [app.id, app.badge])).toEqual([
    ["navigator", undefined],
    ["messages", 3],
  ]);
});
