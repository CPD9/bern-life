import { expect, test } from "bun:test";
import { type AppEventName, createAppEvents } from "./app-events";

test("listeners get every event until they unsubscribe", () => {
  const events = createAppEvents();
  const heard: AppEventName[] = [];
  const stop = events.subscribe((name) => heard.push(name));
  events.emit("search_answered");
  events.emit("evidence_opened");
  stop();
  events.emit("report_made");
  expect(heard).toEqual(["search_answered", "evidence_opened"]);
});
