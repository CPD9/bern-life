import { requestUser } from "@/features/accounts/http";
import { failure } from "@/features/messages/http";
import { eventStream, hub } from "@/features/messages/live";

/** Server-Sent Events: one `message` event per notice for the signed-in user, ids only. */
export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  return new Response(eventStream(hub(), user.id, request.signal), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
