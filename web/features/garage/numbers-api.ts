import { type Numbers, parseNumbers } from "./numbers";

/** A 404 means the route is not there yet (Next's own page or the engine's `not_found`). */
export type NumbersOutcome =
  | { readonly status: "ok"; readonly numbers: Numbers }
  | { readonly status: "not_connected" }
  | { readonly status: "error" };

export type GarageApi = { numbers(): Promise<NumbersOutcome> };

const ERROR: NumbersOutcome = { status: "error" };

export async function readNumbers(fetchNumbers: () => Promise<Response>): Promise<NumbersOutcome> {
  let response: Response;
  try {
    response = await fetchNumbers();
  } catch {
    return ERROR;
  }
  if (response.status === 404) return { status: "not_connected" };
  if (!response.ok) return ERROR;
  const numbers = parseNumbers(await response.json().catch(() => null));
  return numbers ? { status: "ok", numbers } : ERROR;
}

export const httpGarageApi: GarageApi = {
  numbers: () => readNumbers(() => fetch("/api/numbers")),
};
