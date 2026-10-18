// The shapes /api/messages/* returns, shared by the routes and the Messages app.
export type Person = { handle: string; displayName: string };

export type ConversationSummary = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  /** Everyone in the conversation but you, by handle. */
  others: Person[];
  last: { body: string; at: string; author: Person } | null;
  unread: number;
};

export type MessageView = {
  id: string;
  author: Person;
  body: string;
  createdAt: string;
  mine: boolean;
};

/** Newest first; `next` fetches the page before the oldest message shown. */
export type MessagePage = { messages: MessageView[]; next: string | null };

/** What the live stream sends: ids only, never a message body. */
export type Notice = { conversationId: string; messageId: string; kind: "posted" | "deleted" };
