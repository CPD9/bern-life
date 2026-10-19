import { maxAgentBodyBytes, parseAgentRequest } from "@/infrastructure/agent-request";
import { engineResponse } from "@/infrastructure/engine-response";
import type { EngineProxy } from "@/infrastructure/engine-types";
import { readJsonBody } from "@/infrastructure/json-body";

// The body is checked before the guard, so a request refused anyway never counts as a live call.
export async function proxyAgent(request: Request, proxy: EngineProxy): Promise<Response> {
  const body = await readJsonBody(request, maxAgentBodyBytes);
  if (!body.ok) return body.response;
  const agentRequest = parseAgentRequest(body.value);
  if (agentRequest === null) return Response.json({ error: "bad_request" }, { status: 400 });
  const access = await proxy.guard(request, "agent");
  if (!access.ok) return access.response;
  return engineResponse(await proxy.engine().agent(agentRequest, { live: access.live }));
}
