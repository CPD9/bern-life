import { saveProfile } from "@/features/accounts/accounts";
import { crossSite, failure, jsonBody, requestUser } from "@/features/accounts/http";
import { parseProfile } from "@/features/accounts/input";
import { db } from "@/infrastructure/db";

/** Onboarding (W3) saves here when signed in; signed out it keeps the answers in the browser. */
export async function PUT(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const profile = parseProfile(await jsonBody(request));
  if (profile === null) return failure("bad_request");
  await saveProfile(db(), user, profile, new Date());
  return new Response(null, { status: 204 });
}
