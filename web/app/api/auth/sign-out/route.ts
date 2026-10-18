import { signOut } from "@/features/accounts/accounts";
import { crossSite, signedOut } from "@/features/accounts/http";
import { db } from "@/infrastructure/db";
import { sessionToken } from "@/infrastructure/session";

export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const token = sessionToken(request);
  if (token !== null) await signOut(db(), token);
  return signedOut();
}
