import { describe, expect, test } from "bun:test";
import { NOTE_MAX, isRequestId, parseAnswer, parseAsk } from "./input";

describe("connection input", () => {
  test("a request names a handle and may carry a note of up to 280 characters", () => {
    expect(parseAsk({ handle: " Bea " })).toEqual({ handle: "bea", note: null });
    expect(parseAsk({ handle: "bea", note: "  Line one\r\nline two " })).toEqual({
      handle: "bea",
      note: "Line one\nline two",
    });
    expect(parseAsk({ handle: "bea", note: "   " })).toEqual({ handle: "bea", note: null });
    expect(parseAsk({ handle: "bea", note: "x".repeat(NOTE_MAX) })?.note?.length).toBe(280);
    expect([
      parseAsk({ handle: "bea", note: "x".repeat(NOTE_MAX + 1) }),
      parseAsk({ handle: "bea", note: "bell\u0007" }),
      parseAsk({ handle: "bea", note: 7 }),
      parseAsk({ handle: "b" }),
      parseAsk({ handle: "ada@example.org" }),
      parseAsk(null),
    ]).toEqual([null, null, null, null, null, null]);
  });

  test("an answer is accept, decline or withdraw; ids are uuids", () => {
    expect([parseAnswer({ answer: "accept" }), parseAnswer({ answer: "withdraw" })]).toEqual([
      "accept",
      "withdraw",
    ]);
    expect([parseAnswer({ answer: "block" }), parseAnswer({})]).toEqual([null, null]);
    expect([isRequestId("11111111-1111-4111-8111-111111111111"), isRequestId("1")]).toEqual([
      true,
      false,
    ]);
  });
});
