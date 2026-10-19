// Invented bodies in the shape Run A gave for GET /api/numbers. They mirror that shape until
// PR-A1's own fixtures land in contracts/; no value here was measured.
import type { NumbersApi, NumbersOutcome } from "@/infrastructure/numbers-api";

export function numbersBody() {
  return {
    snapshot: "demo-snapshot-1",
    generated_at: "2026-10-18T22:30:00Z",
    eval: {
      queries: 48,
      recall_at_10: { value: 0.4375, low: 0.29, high: 0.58 },
      mrr: 0.31,
      invented_abstained: { n: 7, of: 10 },
      false_abstention: { n: 2, of: 38 },
      traceable: { n: 812, of: 812 },
      invented_entities: 0,
      slices: [
        { name: "en", recall_at_10: 0.5 },
        { name: "de", recall_at_10: { value: 0.25, low: 0.05, high: 0.5 } },
      ],
    },
    models: [
      {
        role: "expand",
        model: "demo-model-large",
        calls: 120,
        ok: 118,
        median_ms: 584,
        p95_ms: 1210.5,
      },
      { role: "brief", model: "demo-model-small", calls: 0, ok: 0, median_ms: null, p95_ms: null },
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
export function queuedApi(outcomes: NumbersOutcome[]): NumbersApi & { calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    numbers: async () => {
      calls += 1;
      const next = outcomes.shift();
      if (next === undefined) throw new Error("no outcome queued");
      return next;
    },
  };
}
