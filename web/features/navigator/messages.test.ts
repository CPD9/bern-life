import { describe, expect, test } from "bun:test";
import { abstainedFixture, copyOf } from "@/test/fixtures";
import { abstainMessage, canRetry, failureMessage } from "./messages";
import type { BriefUnread, NavigatorFailure } from "./navigator-api";

const unread = (reason: BriefUnread): NavigatorFailure => ({ kind: "unread", reason });

describe("failureMessage", () => {
  test("a brief the engine read no need from gets one sentence per reason, each with a next step", () => {
    expect(failureMessage(unread("no_model"))).toBe(
      "No model is connected, so a new brief cannot be read. Ask a question instead; the search itself needs no model.",
    );
    expect(failureMessage(unread("not_recorded"))).toBe(
      "This brief has not been read before, and Apertus was not connected live for it. Sign in for a live run, or ask a question instead.",
    );
    expect(failureMessage(unread("budget_used"))).toBe(
      "Today's Apertus calls are used up, so this brief could not be read. Try again tomorrow, or ask a question instead.",
    );
    expect(failureMessage(unread("model_failed"))).toBe(
      "Apertus did not answer while reading your brief. Try again in a moment.",
    );
    expect(failureMessage(unread("no_need_found"))).toBe(
      "Apertus found no need in this brief that it could quote word for word. Paste the sentences that say what your project needs.",
    );
  });

  test("a brief over the engine's limit says the number and what to paste", () => {
    expect(failureMessage({ kind: "brief", reason: "too_long" })).toBe(
      "This brief is longer than 20,000 characters. Paste the key paragraphs instead.",
    );
  });
});

describe("canRetry", () => {
  test("only a model that did not answer is worth another try among unread briefs", () => {
    const reasons: BriefUnread[] = [
      "no_model",
      "not_recorded",
      "budget_used",
      "model_failed",
      "no_need_found",
    ];
    expect(reasons.map((reason) => canRetry(unread(reason)))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  test("network and engine failures retry, a refusal over the limit and a refused brief do not", () => {
    expect(canRetry({ kind: "network" })).toBe(true);
    expect(canRetry({ kind: "engine", error: "engine_error" })).toBe(true);
    expect(canRetry({ kind: "engine", error: "rate_limited" })).toBe(false);
    expect(canRetry({ kind: "brief", reason: "too_long" })).toBe(false);
  });
});

describe("abstainMessage", () => {
  test("each abstain reason has its own plain sentence", () => {
    expect(abstainMessage(abstainedFixture)).toBe(
      "No public page we hold supports an answer to this. We would rather say so than guess.",
    );
    expect(
      abstainMessage({ ...copyOf(abstainedFixture), abstain_reason: "query_out_of_scope" }),
    ).toBe(
      "This is outside what the Navigator covers: research and expertise at the University of Bern, ARTORG and Diabetes Center Berne.",
    );
    expect(abstainMessage({ ...copyOf(abstainedFixture), abstain_reason: "engine_error" })).toBe(
      "The search could not finish, so there is nothing we can show.",
    );
  });
});
