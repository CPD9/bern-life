import { expect, test } from "bun:test";
import { showMeRoute } from "./show-me-route";

test("Show me opens the map, the settle dialog, or the app on the phone where the step happens", () => {
  expect(showMeRoute("map")).toEqual({ kind: "view", view: "map" });
  expect(showMeRoute("settle")).toEqual({ kind: "settle" });
  expect(showMeRoute("ask")).toEqual({ kind: "phone-app", appId: "ask" });
  expect(showMeRoute("opportunities")).toEqual({ kind: "phone-app", appId: "opportunities" });
});
