import { appMemberDeps, failure, withoutAccounts } from "../member-route";
import { listNotifications } from "./handlers";

/** Your newest in-app notifications: kind, a title made of names, time and whether read. */
export async function GET(request: Request): Promise<Response> {
  if (withoutAccounts()) return failure("unauthenticated");
  return listNotifications(request, appMemberDeps());
}
