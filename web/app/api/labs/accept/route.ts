import { crossSite, jsonBody, requestUser } from "@/features/accounts/http";
import { failure } from "@/features/labs/http";
import { parseCode } from "@/features/labs/input";
import { acceptLabInvite } from "@/features/labs/store";
import { db } from "@/infrastructure/db";

/** Joins a lab with a one-time invite code from its lead. */
export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const code = parseCode(await jsonBody(request));
  if (code === null) return failure("bad_request");
  const labId = await acceptLabInvite(db(), user.id, code, new Date());
  return labId === "invite_invalid" ? failure(labId) : Response.json({ labId });
}
