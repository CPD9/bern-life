import { deleteAccount } from "@/features/accounts/accounts";
import { crossSite, failure, jsonBody, requestUser, signedOut } from "@/features/accounts/http";
import { password } from "@/features/accounts/input";
import { profileOf } from "@/features/accounts/store";
import { db } from "@/infrastructure/db";

export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  return Response.json({ user, profile: await profileOf(db(), user.id) });
}

/** Deletes the account and everything of it; asks for the password again. */
export async function DELETE(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const body = (await jsonBody(request)) as { password?: unknown } | null;
  const given = password(body?.password);
  if (given === null) return failure("invalid_credentials");
  const outcome = await deleteAccount(db(), user, given);
  return outcome.ok ? signedOut() : failure(outcome.error);
}
