import { describe, expect, test } from "bun:test";
import { httpOpportunitiesApi } from "./opportunities-api";
import { opportunityRequest, opportunityResults } from "./opportunity-request";
import { mixedResponse } from "./testing";

describe("opportunityRequest", () => {
  test("asks for calls, services and spaces with the trimmed query", () => {
    expect(JSON.stringify(opportunityRequest("  lab space in Bern \n"))).toBe(
      '{"query":"lab space in Bern","kinds":["call","service","space"]}',
    );
  });

  test("an empty or overlong query is not sent", () => {
    expect(opportunityRequest("   ")).toBeNull();
    expect(opportunityRequest("a".repeat(501))).toBeNull();
    expect(opportunityRequest("a".repeat(500))?.query).toBe("a".repeat(500));
  });
});

describe("httpOpportunitiesApi", () => {
  test("posts exactly the request as JSON to the search", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const api = httpOpportunitiesApi(async (url, init) => {
      sent.push({ url, init });
      return Response.json(mixedResponse());
    });
    const request = opportunityRequest("seed funding");
    if (request === null) throw new Error("request expected");
    const outcome = await api.search(request);
    expect(outcome).toEqual({ ok: true, response: mixedResponse() });
    expect(sent).toEqual([
      {
        url: "/api/search",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"query":"seed funding","kinds":["call","service","space"]}',
        },
      },
    ]);
  });

  test("a 404 is not connected, a refusal and a crash are told apart, and so is no network", async () => {
    const request = { query: "q", kinds: [] };
    const answer = (response: Response) => httpOpportunitiesApi(async () => response);
    expect(
      await answer(Response.json({ error: "not_found" }, { status: 404 })).search(request),
    ).toEqual({ ok: false, failure: "not_connected" });
    expect(await answer(new Response("Not Found", { status: 404 })).search(request)).toEqual({
      ok: false,
      failure: "not_connected",
    });
    expect(
      await answer(Response.json({ error: "bad_request" }, { status: 400 })).search(request),
    ).toEqual({ ok: false, failure: "bad_request" });
    expect(
      await answer(Response.json({ error: "engine_error" }, { status: 502 })).search(request),
    ).toEqual({ ok: false, failure: "engine_error" });
    const offline = httpOpportunitiesApi(async () => {
      throw new TypeError("offline");
    });
    expect(await offline.search(request)).toEqual({ ok: false, failure: "network" });
  });
});

describe("opportunityResults", () => {
  test("keeps only calls, services and spaces, with the engine's ranks", () => {
    expect(opportunityResults(mixedResponse()).map((r) => [r.rank, r.profile.id])).toEqual([
      [1, "call-example-demo-seed-grant"],
    ]);
  });
});
