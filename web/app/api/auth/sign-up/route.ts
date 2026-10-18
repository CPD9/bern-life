import { signUp } from "@/features/accounts/accounts";
import { crossSite, failure, jsonBody, signedIn } from "@/features/accounts/http";
import { parseSignUp } from "@/features/accounts/input";
import { db } from "@/infrastructure/db";
import { clientIp } from "@/infrastructure/session";

export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const input = parseSignUp(await jsonBody(request));
  if (input === null) return failure("bad_request");
  const outcome = await signUp(db(), input, clientIp(request), new Date());
  return outcome.ok ? signedIn(outcome.value) : failure(outcome.error);
}
