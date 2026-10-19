import { describe, expect, test } from "bun:test";
import { agentNameMaxLength, parseAgentName, shownAgentName } from "./agent-name";

describe("shownAgentName", () => {
  test("a blank or whitespace-only name reads as Bärli", () => {
    expect(["", " ", "\t\n "].map(shownAgentName)).toEqual(["Bärli", "Bärli", "Bärli"]);
  });

  test("a name is shown trimmed", () => {
    expect(shownAgentName("  Bruno  ")).toBe("Bruno");
  });
});

describe("parseAgentName", () => {
  test("a stored name is cut at 24 characters", () => {
    expect(agentNameMaxLength).toBe(24);
    expect(parseAgentName("a".repeat(30))).toBe("a".repeat(24));
    expect(parseAgentName("Bruno")).toBe("Bruno");
  });

  test("anything but a string is no name", () => {
    expect([null, undefined, 7, ["Bruno"], { name: "Bruno" }].map(parseAgentName)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
