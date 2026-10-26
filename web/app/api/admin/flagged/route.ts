import { engine } from "@/infrastructure/engine";
import { appMemberDeps, failure, withoutAccounts } from "../../member-route";
import { adminFlagged } from "../handlers";

/** Person profiles whose name reads as a company or group, for an admin to check. */
export async function GET(request: Request): Promise<Response> {
  if (withoutAccounts()) return failure("unauthenticated");
  return adminFlagged(request, { ...appMemberDeps(), engine });
}
