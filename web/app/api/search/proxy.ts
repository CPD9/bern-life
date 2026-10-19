import { engineResponse } from "@/infrastructure/engine-response";
import type { EngineProxy } from "@/infrastructure/engine-types";
import { readJsonBody } from "@/infrastructure/json-body";
import { maxSearchBodyBytes, parseSearchRequest } from "@/infrastructure/search-request";

// The body is checked before the guard, so a request refused anyway never counts as a live call.
export async function proxySearch(request: Request, proxy: EngineProxy): Promise<Response> {
  const body = await readJsonBody(request, maxSearchBodyBytes);
  if (!body.ok) return body.response;
  const searchRequest = parseSearchRequest(body.value);
  if (searchRequest === null) return Response.json({ error: "bad_request" }, { status: 400 });
  const access = await proxy.guard(request, "search");
  if (!access.ok) return access.response;
  return engineResponse(await proxy.engine().search(searchRequest, { live: access.live }));
}
