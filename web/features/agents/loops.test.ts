import { describe, expect, test } from "bun:test";
import { copyOf } from "@/test/fixtures";
import {
  type Loop,
  diffEntries,
  entriesOf,
  isFailedRun,
  loopId,
  makeLoop,
  needsRun,
  noticeFor,
  recordRun,
  removeLoop,
  runSummary,
  saveLoop,
} from "./loops";
import type { Kind } from "./kinds";
import { entry, responseWith } from "./testing";

function saved(query: string, kinds: readonly Kind[] = []): Loop {
  const loop = makeLoop(query, kinds);
  if (loop === null) throw new Error("invalid loop");
  return loop;
}

describe("saving loops", () => {
  test("a loop keeps the cleaned query and its kinds in the contract's order", () => {
    expect(makeLoop("  glucose   sensors ", ["unit", "person"])).toEqual({
      id: "glucose sensors|person,unit",
      query: "glucose sensors",
      kinds: ["person", "unit"],
      last: null,
      changes: null,
    });
  });

  test("an empty or too long query is not a loop", () => {
    expect(makeLoop("   ", [])).toBeNull();
    expect(makeLoop("a".repeat(501), [])).toBeNull();
  });

  test("the same words and kinds in another case or order are the same loop", () => {
    expect(loopId("Glucose Sensors", ["unit", "person"])).toBe(
      loopId("glucose sensors", ["person", "unit"]),
    );
    expect(loopId("glucose sensors", ["unit"])).not.toBe(loopId("glucose sensors", []));
  });

  test("saving a loop twice keeps the first one and its runs", () => {
    const first = recordRun(saved("insulin"), responseWith("s1", [["a", "person"]]));
    const loops = saveLoop([first], saved("Insulin"));
    expect(loops).toEqual([first]);
    expect(saveLoop(loops, saved("pumps"))).toEqual([first, saved("pumps")]);
  });

  test("removing a loop drops only that loop", () => {
    const loops = [saved("insulin"), saved("pumps")];
    expect(removeLoop(loops, "insulin|")).toEqual([saved("pumps")]);
  });
});

describe("running loops", () => {
  test("results are narrowed to the loop's kinds, in rank order", () => {
    const response = responseWith("s1", [
      ["a", "person"],
      ["b", "call"],
      ["c", "unit"],
    ]);
    expect(entriesOf(response, ["unit", "call"])).toEqual([entry("b", "call"), entry("c", "unit")]);
    expect(entriesOf(response, []).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  test("the first run sets the baseline and reports no changes", () => {
    const loop = recordRun(saved("insulin"), responseWith("s1", [["a", "person"]]));
    expect(loop.last).toEqual({ snapshot: "s1", mock: false, entries: [entry("a")] });
    expect(loop.changes).toBeNull();
  });

  test("a later run lists new results, then dropped ones", () => {
    const first = recordRun(
      saved("insulin"),
      responseWith(
        "s1",
        [
          ["a", "person"],
          ["b", "person"],
        ],
        "mock",
      ),
    );
    const second = recordRun(
      first,
      responseWith(
        "s2",
        [
          ["b", "person"],
          ["c", "unit"],
        ],
        "mock",
      ),
    );
    expect(second.last).toEqual({
      snapshot: "s2",
      mock: true,
      entries: [entry("b"), entry("c", "unit")],
    });
    expect(second.changes).toEqual([
      { type: "new", entry: entry("c", "unit") },
      { type: "dropped", entry: entry("a") },
    ]);
  });

  test("a MOCK run is never compared with a replay or live run, either way round", () => {
    const replay = responseWith("s1", [["a", "person"]]);
    const mock = responseWith("fixture", [["b", "person"]], "mock");
    const live = responseWith("s2", [["c", "person"]], "live");
    const afterMock = recordRun(recordRun(saved("insulin"), replay), mock);
    expect([afterMock.last?.mock, afterMock.changes]).toEqual([true, null]);
    const afterLive = recordRun(afterMock, live);
    expect([afterLive.last?.mock, afterLive.changes]).toEqual([false, null]);
    expect(recordRun(afterLive, replay).changes).toEqual([
      { type: "new", entry: entry("a") },
      { type: "dropped", entry: entry("c") },
    ]);
  });

  test("the same results again are no changes", () => {
    const response = responseWith("s1", [["a", "person"]]);
    expect(recordRun(recordRun(saved("insulin"), response), response).changes).toEqual([]);
  });

  test("diffing keeps each side's order", () => {
    expect(
      diffEntries([entry("a"), entry("b"), entry("c")], [entry("d"), entry("b"), entry("e")]),
    ).toEqual([
      { type: "new", entry: entry("d") },
      { type: "new", entry: entry("e") },
      { type: "dropped", entry: entry("a") },
      { type: "dropped", entry: entry("c") },
    ]);
  });

  test("an engine error is a failed run; an abstention is an empty answer", () => {
    const abstained = responseWith("s1", []);
    abstained.abstained = true;
    abstained.abstain_reason = "no_verifiable_source";
    const broken = copyOf(abstained);
    broken.abstain_reason = "engine_error";
    expect(isFailedRun(null)).toBe(true);
    expect(isFailedRun(broken)).toBe(true);
    expect(isFailedRun(abstained)).toBe(false);
  });
});

describe("notices and snapshots", () => {
  const loop: Loop = {
    ...saved("insulin pumps"),
    last: { snapshot: "s2", mock: false, entries: [] },
  };

  test("a new result names the loop, the result and the snapshot, and links the source", () => {
    expect(noticeFor(loop, { type: "new", entry: entry("c", "call") })).toEqual({
      title: "New in “insulin pumps”",
      body: "Name c (funding call) is a new result on snapshot s2.",
      href: "https://www.example-institute.test/c",
    });
  });

  test("a dropped result says it is no longer a result", () => {
    expect(noticeFor(loop, { type: "dropped", entry: entry("a") })).toEqual({
      title: "Dropped from “insulin pumps”",
      body: "Name a (person) is no longer a result on snapshot s2.",
      href: "https://www.example-institute.test/a",
    });
  });

  test("a change found between MOCK runs says it is MOCK", () => {
    const mockLoop: Loop = { ...loop, last: { snapshot: "fixture", mock: true, entries: [] } };
    expect(noticeFor(mockLoop, { type: "new", entry: entry("c") }).body).toBe(
      "Name c (person) is a new result on snapshot fixture (MOCK).",
    );
  });

  test("a loop asks for a new run only when it ran on another known snapshot", () => {
    expect(needsRun(loop, "s3")).toBe(true);
    expect(needsRun(loop, "s2")).toBe(false);
    expect(needsRun(loop, null)).toBe(false);
    expect(needsRun(saved("insulin"), "s3")).toBe(false);
  });
});

describe("runSummary", () => {
  const run = (snapshot: string, ids: string[], mode: "replay" | "mock" = "replay") =>
    responseWith(
      snapshot,
      ids.map((id) => [id, "person"] as const),
      mode,
    );

  test("the first run says the next one lists what changed", () => {
    const first = recordRun(saved("insulin"), run("s1", ["a"]));
    expect(runSummary(null, first)).toBe("Ran on snapshot s1. The next run lists what changed.");
  });

  test("a later run counts what is new and what dropped", () => {
    const first = recordRun(saved("insulin"), run("s1", ["a", "b"]));
    const second = recordRun(first, run("s2", ["b", "c", "d"]));
    expect(runSummary(first.last, second)).toBe("Ran on snapshot s2: 2 new, 1 dropped.");
    const third = recordRun(second, run("s2", ["b", "c", "d"]));
    expect(runSummary(second.last, third)).toBe("Ran on snapshot s2: nothing new or dropped.");
  });

  test("a switch to or from MOCK says the two runs were not compared", () => {
    const real = recordRun(saved("insulin"), run("s1", ["a"]));
    const mock = recordRun(real, run("fixture", ["b"], "mock"));
    expect(runSummary(real.last, mock)).toBe(
      "Ran on snapshot fixture (MOCK). The run before was not MOCK, so the two were not compared; the next run compares with this one.",
    );
    const back = recordRun(mock, run("s1", ["a"]));
    expect(runSummary(mock.last, back)).toBe(
      "Ran on snapshot s1. The run before was MOCK, so the two were not compared; the next run compares with this one.",
    );
  });
});
