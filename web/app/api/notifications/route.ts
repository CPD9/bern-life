import { appMemberDeps } from "../member-route";
import { listNotifications } from "./handlers";

/** Your newest in-app notifications: kind, a title made of names, time and whether read. */
export function GET(request: Request): Promise<Response> {
  return listNotifications(request, appMemberDeps());
}
