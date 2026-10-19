// The person profiles of one place on the map, read from the loaded snapshot without a search.
// Read-only and model-free, so it needs no guard; ids the engine could not hold never reach it.
import type { EngineClient } from "@/infrastructure/engine-types";
import { engineResponse } from "@/infrastructure/engine-response";

const SOURCE_ID = /^[a-z0-9-]+$/;
const HOST = /^[a-z0-9.-]+$/;

export type PlaceParams = { readonly source: string; readonly host: string };

export async function placePeople(
  params: PlaceParams,
  engine: () => EngineClient,
): Promise<Response> {
  if (!SOURCE_ID.test(params.source) || !HOST.test(params.host)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  return engineResponse(await engine().placePeople(params.source, params.host));
}
