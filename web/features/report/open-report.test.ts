import { expect, test } from "bun:test";
import type { AppEventName } from "@/infrastructure/app-events";
import { resultFixture } from "@/test/fixtures";
import { openReport } from "./open-report";

function deps(saved: string | null) {
  const opened: string[] = [];
  const emitted: AppEventName[] = [];
  return {
    opened,
    emitted,
    deps: {
      store: { save: () => saved, load: () => null, list: () => [] },
      events: { emit: (name: AppEventName) => void emitted.push(name) },
      open: (id: string) => void opened.push(id),
    },
  };
}

test("a saved report opens and counts as report_made", () => {
  const run = deps("r1");
  expect(openReport(resultFixture, true, run.deps)).toBe(true);
  expect(run.opened).toEqual(["r1"]);
  expect(run.emitted).toEqual(["report_made"]);
});

test("blocked storage opens nothing and emits nothing", () => {
  const run = deps(null);
  expect(openReport(resultFixture, true, run.deps)).toBe(false);
  expect(run.opened).toEqual([]);
  expect(run.emitted).toEqual([]);
});
