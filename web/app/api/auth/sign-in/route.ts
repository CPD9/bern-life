import { signIn } from "@/features/accounts/accounts";
import { crossSite, failure, jsonBody, signedIn } from "@/features/accounts/http";
import { parseSignIn } from "@/features/accounts/input";
import { db } from "@/infrastructure/db";
import { clientIp, sessionToken } from "@/infrastructure/session";

export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const input = parseSignIn(await jsonBody(request));
  if (input === null) return failure("bad_request");
  const outcome = await signIn(db(), input, clientIp(request), new Date(), sessionToken(request));
  return outcome.ok ? signedIn(outcome.value) : failure(outcome.error);
}
