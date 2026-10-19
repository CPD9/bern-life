// The shape of GET /api/numbers, typed here until the generated `Numbers` type lands with the
// contract. The body is checked field by field: anything that does not fit is no answer, so the
// garage shows an error instead of a half-read table.

export type Interval = { readonly value: number; readonly low: number; readonly high: number };
export type Tally = { readonly n: number; readonly of: number };
/** A slice may report recall as a bare value or with its interval. */
export type Measure = number | Interval;

export type EvalNumbers = {
  readonly queries: number;
  readonly recall_at_10: Interval;
  readonly mrr: number;
  readonly invented_abstained: Tally;
  readonly false_abstention: Tally;
  readonly traceable: Tally;
  readonly invented_entities: number;
  readonly slices: readonly { readonly name: string; readonly recall_at_10: Measure }[];
};

export type ModelNumbers = {
  readonly role: string;
  readonly model: string;
  readonly calls: number;
  readonly ok: number;
  /** null when the engine recorded no latency for this role. */
  readonly median_ms: number | null;
  readonly p95_ms: number | null;
};

export type Numbers = {
  readonly snapshot: string;
  readonly generated_at: string;
  readonly eval: EvalNumbers | null;
  readonly models: readonly ModelNumbers[];
};

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Fields)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function rate(value: unknown): number | null {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : null;
}

function millis(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function interval(value: unknown): Interval | null {
  const body = fields(value);
  if (!body) return null;
  const [mid, low, high] = [rate(body.value), rate(body.low), rate(body.high)];
  return mid === null || low === null || high === null ? null : { value: mid, low, high };
}

function tally(value: unknown): Tally | null {
  const body = fields(value);
  if (!body) return null;
  const [n, of] = [count(body.n), count(body.of)];
  return n === null || of === null || n > of ? null : { n, of };
}

function slice(value: unknown): EvalNumbers["slices"][number] | null {
  const body = fields(value);
  const name = text(body?.name);
  const recall = rate(body?.recall_at_10) ?? interval(body?.recall_at_10);
  return name === null || recall === null ? null : { name, recall_at_10: recall };
}

function evalNumbers(value: unknown): EvalNumbers | null {
  const body = fields(value);
  if (!body || !Array.isArray(body.slices)) return null;
  const slices = body.slices.map(slice);
  const parsed = {
    queries: count(body.queries),
    recall_at_10: interval(body.recall_at_10),
    mrr: rate(body.mrr),
    invented_abstained: tally(body.invented_abstained),
    false_abstention: tally(body.false_abstention),
    traceable: tally(body.traceable),
    invented_entities: count(body.invented_entities),
  };
  if (Object.values(parsed).some((field) => field === null)) return null;
  if (slices.some((entry) => entry === null)) return null;
  return { ...(parsed as Omit<EvalNumbers, "slices">), slices: slices as EvalNumbers["slices"] };
}

function modelNumbers(value: unknown): ModelNumbers | null {
  const body = fields(value);
  if (!body) return null;
  const [role, model] = [text(body.role), text(body.model)];
  const [calls, ok] = [count(body.calls), count(body.ok)];
  const [median, p95] = [millis(body.median_ms), millis(body.p95_ms)];
  if (role === null || model === null || calls === null || ok === null || ok > calls) return null;
  if (median === undefined || p95 === undefined) return null;
  return { role, model, calls, ok, median_ms: median, p95_ms: p95 };
}

export function parseNumbers(body: unknown): Numbers | null {
  const top = fields(body);
  if (!top || !Array.isArray(top.models)) return null;
  const snapshot = text(top.snapshot);
  const generatedAt = text(top.generated_at);
  if (snapshot === null || generatedAt === null || Number.isNaN(Date.parse(generatedAt))) {
    return null;
  }
  const evaluation = top.eval === null ? null : evalNumbers(top.eval);
  if (top.eval !== null && evaluation === null) return null;
  const models = top.models.map(modelNumbers);
  if (models.some((model) => model === null)) return null;
  return {
    snapshot,
    generated_at: generatedAt,
    eval: evaluation,
    models: models as ModelNumbers[],
  };
}
