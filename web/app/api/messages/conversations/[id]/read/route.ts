import { crossSite, requestUser } from "@/features/accounts/http";
import { done, failure } from "@/features/messages/http";
import { isId } from "@/features/messages/notice";
import { markRead } from "@/features/messages/store";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  return (await markRead(db(), user.id, id, new Date())) ? done() : failure("not_found");
}
