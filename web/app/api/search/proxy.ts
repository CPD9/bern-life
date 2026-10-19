import { engineResponse } from "@/infrastructure/engine-response";
import type { EngineProxy } from "@/infrastructure/engine-types";
import { parseSearchRequest } from "@/infrastructure/search-request";

export async function proxySearch(request: Request, proxy: EngineProxy): Promise<Response> {
  const access = await proxy.guard(request, "search");
  if (!access.ok) return access.response;
  const body: unknown = await request.json().catch(() => null);
  const searchRequest = parseSearchRequest(body);
  if (searchRequest === null) return Response.json({ error: "bad_request" }, { status: 400 });
  return engineResponse(await proxy.engine().search(searchRequest, { live: access.live }));
}
