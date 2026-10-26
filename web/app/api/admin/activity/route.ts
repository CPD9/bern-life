import { engine } from "@/infrastructure/engine";
import { appMemberDeps, failure, withoutAccounts } from "../../member-route";
import { adminActivity } from "../handlers";

/** The engine's model calls per day, for an admin. */
export async function GET(request: Request): Promise<Response> {
  if (withoutAccounts()) return failure("unauthenticated");
  return adminActivity(request, { ...appMemberDeps(), engine });
}
