import { crossSite, requestUser } from "@/features/accounts/http";
import { done, failure } from "@/features/labs/http";
import { leaveLab, removeMember } from "@/features/labs/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string; handle: string }> };

/** Your own handle leaves the lab; another member's handle removes them (lead only). */
export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id, handle } = await params;
  if (!isId(id)) return failure("not_found");
  if (handle === user.handle) {
    const left = await leaveLab(db(), user.id, id);
    if (left === "lead") return failure("lead_cannot_leave");
    return left === "left" ? done() : failure("not_found");
  }
  const removed = await removeMember(db(), user.id, id, handle);
  return removed === "removed" ? done() : failure(removed);
}
