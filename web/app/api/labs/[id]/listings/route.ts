import { crossSite, jsonBody, requestUser } from "@/features/accounts/http";
import { done, failure } from "@/features/labs/http";
import { parseProfileId } from "@/features/labs/input";
import { linkProfile } from "@/features/labs/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

/** Links a public profile from the engine to the lab as a card; it never creates an account. */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  const profileId = parseProfileId(await jsonBody(request));
  if (profileId === null) return failure("bad_request");
  const linked = await linkProfile(db(), user.id, id, profileId, new Date());
  if (linked === "not_member") return failure("not_found");
  return linked === "linked" ? done() : failure(linked);
}
