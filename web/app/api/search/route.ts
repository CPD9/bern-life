import { engine } from "@/infrastructure/engine";
import { engineResponse } from "@/infrastructure/engine-response";
import { parseSearchRequest } from "@/infrastructure/search-request";

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const searchRequest = parseSearchRequest(body);
  if (searchRequest === null) return Response.json({ error: "bad_request" }, { status: 400 });
  return engineResponse(await engine().search(searchRequest));
}
