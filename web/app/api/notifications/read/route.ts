import { appMemberDeps } from "../../member-route";
import { readNotifications } from "../handlers";

/** Marks some of your notifications read, or all of them. */
export function POST(request: Request): Promise<Response> {
  return readNotifications(request, appMemberDeps());
}
