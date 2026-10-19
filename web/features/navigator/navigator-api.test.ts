import { describe, expect, test } from "bun:test";
import { createHttpNavigatorApi } from "./navigator-api";

const answering = (response: Response) => createHttpNavigatorApi(async () => response);

describe("httpNavigatorApi", () => {
  test("each error marker reaches the panel; anything else is an engine error", async () => {
    const markers = [
      [Response.json({ error: "bad_request" }, { status: 400 }), "bad_request"],
      [Response.json({ error: "rate_limited" }, { status: 429 }), "rate_limited"],
      [Response.json({ error: "engine_error" }, { status: 502 }), "engine_error"],
      [new Response("upstream timed out at 10.0.0.3", { status: 502 }), "engine_error"],
    ] as const;
    for (const [response, error] of markers) {
      expect(await answering(response).search({ query: "CGM" })).toEqual({
        ok: false,
        failure: { kind: "engine", error },
      });
    }
  });

  test("a brief refused over the limit is told apart from a brief the app could not read", async () => {
    const refused = Response.json({ error: "rate_limited" }, { status: 429 });
    expect(await answering(refused).brief({ kind: "text", text: "A night alarm" })).toEqual({
      ok: false,
      failure: { kind: "engine", error: "rate_limited" },
    });
    const unread = Response.json({ error: "bad_request", reason: "no_text" }, { status: 400 });
    expect(await answering(unread).brief({ kind: "text", text: "" })).toEqual({
      ok: false,
      failure: { kind: "brief", reason: "no_text" },
    });
  });
});
