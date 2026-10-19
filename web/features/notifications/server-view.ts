// What a stored notification says, from the current state of what it is about. Only names and
// fixed words: never a message's text or a request's note. A notification about something gone
// (a conversation you left) says nothing and is left out.
import type { ServerKind, StoredNotification } from "./server-store";

export type InboxItem = {
  id: string;
  kind: ServerKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

type Words = { title: string; body: string };

function connectionWords(about: Record<string, unknown>): Words | null {
  const name = String(about.displayName);
  const outgoing = about.outgoing === true;
  if (about.status === "pending" && !outgoing) {
    return { title: `${name} asks to connect`, body: "Open Connections to accept or decline." };
  }
  if (about.status === "accepted") {
    return outgoing
      ? { title: `${name} accepted your request`, body: "You are connected now." }
      : { title: `You and ${name} are connected`, body: "They are in You, under People." };
  }
  if (about.status === "declined" && !outgoing) {
    return {
      title: `You declined ${name}'s request`,
      body: "They see it as declined in Connections.",
    };
  }
  return null;
}

function messageWords(about: Record<string, unknown>): Words {
  const from = about.from as { displayName?: unknown } | null;
  const body = "Open Messages to read it.";
  if (about.kind === "group" && typeof about.title === "string") {
    return { title: `New message in ${about.title}`, body };
  }
  return typeof from?.displayName === "string"
    ? { title: `New message from ${from.displayName}`, body }
    : { title: "New message", body };
}

export function inboxItem(stored: StoredNotification): InboxItem | null {
  if (stored.about === null) return null;
  const about = stored.about as Record<string, unknown>;
  const words = stored.kind === "connection" ? connectionWords(about) : messageWords(about);
  if (words === null) return null;
  return {
    id: stored.id,
    kind: stored.kind,
    ...words,
    at: stored.createdAt.toISOString(),
    read: stored.read,
  };
}
