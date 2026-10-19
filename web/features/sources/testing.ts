// Invented bodies in the shape Run A gave for GET /api/sources. They mirror that shape until
// PR-A1's own fixtures land in contracts/; the institutes and hosts do not exist.
import type { SourcesApi, SourcesOutcome } from "./sources-api";

export function sourcesBody() {
  return {
    snapshot: "demo-snapshot-1",
    sources: [
      {
        id: "demo-institute",
        name: "Demo Institute",
        hosts: ["www.demo-institute.test", "lab.demo-institute.test"],
        kinds: ["person", "unit"],
        pages: 42,
        profiles: 17,
        newest_fetched_at: "2026-10-18T22:30:00Z",
      },
      {
        id: "demo-calls",
        name: "Demo Calls Office",
        hosts: ["calls.demo.test"],
        kinds: [],
        pages: 0,
        profiles: 0,
        newest_fetched_at: null,
      },
    ],
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Answers each call with the next outcome in the queue and counts the calls. */
export function queuedApi(outcomes: SourcesOutcome[]): SourcesApi & { calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    list: async () => {
      calls += 1;
      const next = outcomes.shift();
      if (next === undefined) throw new Error("no outcome queued");
      return next;
    },
  };
}
