// A new message tells the other members of its conversation, in the app only: one unread
// notification per conversation, holding its id and never the text. Reading the conversation
// marks that notification read. A notification that cannot be written is logged and the message
// still counts as sent, so a retry never posts it twice.
import { membersOf, post } from "@/features/messages/store";
import type { MessageView } from "@/features/messages/types";
import { markReadAbout, notifyUser } from "@/features/notifications/server-store";
import type { Db, Sql } from "@/infrastructure/db";

type LogError = (message: string, cause: unknown) => void;

const logToServer: LogError = (message, cause) => console.error(message, cause);

export async function tellMembers(
  db: Db,
  conversationId: string,
  authorId: string,
  now: Date,
): Promise<void> {
  for (const member of await membersOf(db, conversationId)) {
    if (member !== authorId) await notifyUser(db, member, "message", conversationId, now);
  }
}

/** Posts as `post` does, then tells the others; null when the caller is not a member. */
export async function postAndTell(
  sql: Sql,
  me: string,
  conversationId: string,
  body: string,
  now: Date,
  logError: LogError = logToServer,
): Promise<MessageView | null> {
  const message = await post(sql, me, conversationId, body, now);
  if (message === null) return null;
  try {
    await tellMembers(sql, conversationId, me, now);
  } catch (error) {
    logError("messages: the arrival notification was not written", error);
  }
  return message;
}

export async function readArrivals(
  db: Db,
  me: string,
  conversationId: string,
  now: Date,
): Promise<void> {
  await markReadAbout(db, me, "message", conversationId, now);
}
