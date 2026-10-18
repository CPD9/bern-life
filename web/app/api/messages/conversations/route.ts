import { crossSite, jsonBody, requestUser } from "@/features/accounts/http";
import { failure } from "@/features/messages/http";
import { parseStart } from "@/features/messages/input";
import { conversationsOf, startConversation } from "@/features/messages/store";
import { db } from "@/infrastructure/db";

export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  return Response.json({ conversations: await conversationsOf(db(), user.id) });
}

/** Starts a direct conversation by handle (or returns the existing one), or a titled group. */
export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const start = parseStart(await jsonBody(request));
  if (start === null) return failure("bad_request");
  const id = await startConversation(db(), user.id, start);
  return id === "unknown_handle" ? failure(id) : Response.json({ id });
}
