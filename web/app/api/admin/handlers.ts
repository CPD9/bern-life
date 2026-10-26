// The Admin app's reads: the engine's audit of model calls per day, and the person profiles whose
// name reads as a company. Both are plain proxies of loopback engine routes, gated here: only a
// signed-in account with the admin role gets an answer, a member is refused as forbidden. Nothing
// is written and no model is called, so there is no origin check and no limit, as for the other
// reads of the member routes.
import type { EngineClient } from "@/infrastructure/engine-types";
import { engineResponse } from "@/infrastructure/engine-response";
import { type MemberRouteDeps, adminFor } from "../member-route";

export type AdminDeps = MemberRouteDeps & { readonly engine: () => EngineClient };

export async function adminActivity(request: Request, deps: AdminDeps): Promise<Response> {
  const admin = await adminFor(request, deps);
  if (!admin.ok) return admin.response;
  return engineResponse(await deps.engine().adminActivity());
}

export async function adminFlagged(request: Request, deps: AdminDeps): Promise<Response> {
  const admin = await adminFor(request, deps);
  if (!admin.ok) return admin.response;
  return engineResponse(await deps.engine().adminFlagged());
}
