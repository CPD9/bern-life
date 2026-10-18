// Where to go after joining or signing in. Only a short list of the app's own pages is allowed,
// compared as exact strings, so `//host`, absolute URLs and backslash tricks cannot redirect a
// player to another site.

const allowedNext = ["/", "/start", "/navigator"] as const;

export type SafeNext = (typeof allowedNext)[number];

export function safeNext(value: string | string[] | undefined): SafeNext | null {
  if (typeof value !== "string") return null;
  return allowedNext.find((path) => path === value) ?? null;
}
