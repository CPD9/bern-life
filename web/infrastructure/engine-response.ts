import type { EngineError, EngineResult } from "./engine-types";

const statusFor: Record<EngineError, number> = {
  bad_request: 400,
  not_found: 404,
  rate_limited: 429,
  engine_error: 502,
};

export function engineResponse<T>(result: EngineResult<T>): Response {
  return result.ok
    ? Response.json(result.value)
    : Response.json({ error: result.error }, { status: statusFor[result.error] });
}
