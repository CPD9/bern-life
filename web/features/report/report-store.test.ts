import { describe, expect, test } from "bun:test";
import { resultFixture } from "@/test/fixtures";
import { createReportStore } from "./report-store";

function memoryStorage() {
  const saved = new Map<string, string>();
  return {
    saved,
    storage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    },
  };
}

const report = { response: resultFixture, madeAt: "2026-10-18T19:30:00Z", fixture: true };

describe("createReportStore", () => {
  test("saves under a new id and loads the same report back", () => {
    const { saved, storage } = memoryStorage();
    const store = createReportStore(
      () => storage,
      () => "r1",
    );
    expect(store.save(report)).toBe("r1");
    expect([...saved.keys()]).toEqual(["bernlife.report.r1"]);
    expect(store.load("r1")).toEqual(report);
    expect(store.load("r2")).toBeNull();
  });

  test("a stored body that no longer matches the contract is not loaded", () => {
    const { saved, storage } = memoryStorage();
    saved.set("bernlife.report.bad", JSON.stringify({ ...report, response: { query: 1 } }));
    saved.set("bernlife.report.junk", "{not json");
    const store = createReportStore(
      () => storage,
      () => "unused",
    );
    expect(store.load("bad")).toBeNull();
    expect(store.load("junk")).toBeNull();
  });

  test("blocked storage saves nothing and loads nothing", () => {
    const blocked = () => {
      throw new DOMException("denied", "SecurityError");
    };
    const store = createReportStore(blocked, () => "r1");
    expect(store.save(report)).toBeNull();
    expect(store.load("r1")).toBeNull();
  });
});
