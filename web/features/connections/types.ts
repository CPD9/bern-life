// The shapes /api/connections returns, shared by the routes and the Connections app.
export type RequestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type Person = { handle: string; displayName: string };

export type ConnectionView = {
  id: string;
  /** The other member, by handle. */
  person: Person;
  status: RequestStatus;
  direction: "incoming" | "outgoing";
  note: string | null;
  createdAt: string;
  respondedAt: string | null;
  /** You have an unread notification about it, as when it was accepted while you were away. */
  unread: boolean;
};
