import { requestUser } from "@/features/accounts/http";
import { failure } from "@/features/messages/http";
import { unreadTotal } from "@/features/messages/store";
import { db } from "@/infrastructure/db";

/** The badge count; the Messages app also polls it when the live stream is unavailable. */
export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  return Response.json({ unread: await unreadTotal(db(), user.id) });
}
