import { describe, expect, test } from "bun:test";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { abstainedFixture, copyOf } from "@/test/fixtures";
import { abstainMessage } from "./messages";

const noSource =
  "No public page we hold supports an answer to this. We would rather say so than guess.";
const needsModel = "Reading a new brief needs the model; this replay has the recorded briefs only.";

function briefAnswer(mode: SearchResponse["mode"]): SearchResponse {
  return { ...copyOf(abstainedFixture), query: "", mode, brief_terms: [] };
}

describe("abstainMessage", () => {
  test("a brief returned unread without a model says the model is needed", () => {
    expect(abstainMessage(briefAnswer("mock"), "brief")).toBe(needsModel);
  });

  test("a brief a model read but found no source for keeps the no-source sentence", () => {
    expect(abstainMessage(briefAnswer("live"), "brief")).toBe(noSource);
  });

  test("a question without a model is a plain search, so no source means no source", () => {
    expect(abstainMessage(briefAnswer("mock"), "search")).toBe(noSource);
  });

  test("an engine error on a brief is still an engine error", () => {
    const failed = { ...briefAnswer("mock"), abstain_reason: "engine_error" as const };
    expect(abstainMessage(failed, "brief")).toBe(
      "The search could not finish, so there is nothing we can show.",
    );
  });
});
