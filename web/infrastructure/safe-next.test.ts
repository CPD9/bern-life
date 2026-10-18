import { describe, expect, test } from "bun:test";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  test("allows the app's own journey pages", () => {
    expect(safeNext("/start")).toBe("/start");
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/navigator")).toBe("/navigator");
  });

  test("rejects absolute URLs", () => {
    expect(safeNext("https://evil.test/start")).toBeNull();
    expect(safeNext("http://127.0.0.1:3012/start")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
  });

  test("rejects protocol-relative //host", () => {
    expect(safeNext("//evil.test")).toBeNull();
    expect(safeNext("//evil.test/start")).toBeNull();
  });

  test("rejects backslashes, which some browsers read as slashes", () => {
    expect(safeNext("/\\evil.test")).toBeNull();
    expect(safeNext("\\\\evil.test")).toBeNull();
    expect(safeNext("/start\\")).toBeNull();
  });

  test("rejects anything else: other paths, queries, lists and nothing", () => {
    expect(safeNext("/account")).toBeNull();
    expect(safeNext("/start?x=1")).toBeNull();
    expect(safeNext(["/start"])).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
