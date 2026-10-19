import { describe, expect, test } from "bun:test";
import { parseSearchRequest } from "./search-request";

describe("parseSearchRequest", () => {
  test("keeps a trimmed query and a known language", () => {
    expect(parseSearchRequest({ query: "  CGM ", lang: "de" })).toEqual({
      query: "CGM",
      lang: "de",
    });
    expect(parseSearchRequest({ query: "CGM" })).toEqual({ query: "CGM" });
  });

  test("rejects empty, too long, non-string queries and unknown languages", () => {
    expect(parseSearchRequest({ query: " " })).toBeNull();
    expect(parseSearchRequest({ query: "a".repeat(501) })).toBeNull();
    expect(parseSearchRequest({ query: 3 })).toBeNull();
    expect(parseSearchRequest({ query: "CGM", lang: "it" })).toBeNull();
    expect(parseSearchRequest(null)).toBeNull();
  });

  test("passes the kinds to search through", () => {
    expect(
      parseSearchRequest({ query: "seed grant", kinds: ["call", "service", "space"] }),
    ).toEqual({ query: "seed grant", kinds: ["call", "service", "space"] });
    expect(parseSearchRequest({ query: "CGM", lang: "en", kinds: ["person"] })).toEqual({
      query: "CGM",
      lang: "en",
      kinds: ["person"],
    });
  });

  test("rejects empty kinds, an unknown kind and kinds that are not a list", () => {
    expect(parseSearchRequest({ query: "CGM", kinds: [] })).toBeNull();
    expect(parseSearchRequest({ query: "CGM", kinds: ["call", "listing"] })).toBeNull();
    expect(parseSearchRequest({ query: "CGM", kinds: "call" })).toBeNull();
    expect(parseSearchRequest({ query: "CGM", kinds: null })).toBeNull();
  });
});
