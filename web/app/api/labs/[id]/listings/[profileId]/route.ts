import { crossSite, requestUser } from "@/features/accounts/http";
import { done, failure } from "@/features/labs/http";
import { unlinkProfile } from "@/features/labs/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string; profileId: string }> };

/** Unlinks a public profile; whoever linked it or the lead can. */
export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id, profileId } = await params;
  if (!isId(id)) return failure("not_found");
  const removed = await unlinkProfile(db(), user.id, id, profileId);
  return removed ? done() : failure("not_found");
}
