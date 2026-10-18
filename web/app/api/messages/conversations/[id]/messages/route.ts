import { crossSite, jsonBody, requestUser } from "@/features/accounts/http";
import { failure } from "@/features/messages/http";
import { decodeCursor, isId, parseBody, parseLimit } from "@/features/messages/input";
import { messagesIn, post } from "@/features/messages/store";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const before = decodeCursor(query.get("before"));
  const limit = parseLimit(query.get("limit"));
  if (!isId(id)) return failure("not_found");
  if (before === "invalid" || limit === null) return failure("bad_request");
  const page = await messagesIn(db(), user.id, id, before, limit);
  return page === null ? failure("not_found") : Response.json(page);
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  const body = parseBody(await jsonBody(request));
  if (body === null) return failure("bad_request");
  const message = await post(db(), user.id, id, body, new Date());
  return message === null ? failure("not_found") : Response.json({ message }, { status: 201 });
}
