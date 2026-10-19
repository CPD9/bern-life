import { parseAgentRequest } from "@/infrastructure/agent-request";
import { engineResponse } from "@/infrastructure/engine-response";
import type { EngineProxy } from "@/infrastructure/engine-types";

export async function proxyAgent(request: Request, proxy: EngineProxy): Promise<Response> {
  const access = await proxy.guard(request, "agent");
  if (!access.ok) return access.response;
  const raw = await request.text().catch(() => null);
  const agentRequest = raw === null ? null : parseAgentRequest(raw);
  if (agentRequest === null) return Response.json({ error: "bad_request" }, { status: 400 });
  return engineResponse(await proxy.engine().agent(agentRequest, { live: access.live }));
}
