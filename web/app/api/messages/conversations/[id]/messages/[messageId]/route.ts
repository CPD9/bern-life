import { crossSite, requestUser } from "@/features/accounts/http";
import { done, failure } from "@/features/messages/http";
import { isId } from "@/features/messages/input";
import { deleteOwn } from "@/features/messages/store";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string; messageId: string }> };

/** Deletes one of your own messages: hidden for everyone, its text dropped. */
export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id, messageId } = await params;
  if (!isId(id) || !isId(messageId)) return failure("not_found");
  return (await deleteOwn(db(), user.id, id, messageId, new Date()))
    ? done()
    : failure("not_found");
}
