// The words and numbers of the Admin app, as pure functions, so a test checks the exact sentence
// and the screens stay a two-second read: a unit on every number, a reason with every empty state.
import type { AdminActivity, Health } from "@/infrastructure/contract-types.generated";
import type { AdminRefusal } from "./admin-api";

const countFormat = new Intl.NumberFormat("en-GB");
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fetchedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Zurich",
});

export const count = (n: number): string => countFormat.format(n);

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** A UTC day from the audit ("2026-10-19") as "19 Oct". */
export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

/** A fetch time as a Bern date, as the Sources app shows it. */
export function formatFetched(iso: string): string {
  return fetchedFormat.format(new Date(iso));
}

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${plural(minutes, "minute")}`;
  return `${plural(hours, "hour")} ${plural(minutes, "minute")}`;
}

export const MODE_TEXT: Readonly<Record<Health["mode"], string>> = {
  live: "Live: a model answers what is not recorded.",
  replay: "Replay: every answer comes from recorded model calls.",
  mock: "Mock: no model is connected, so the UI shows MOCK.",
};

export function budgetText(activity: AdminActivity): string {
  const { budget, live_today: reached } = activity;
  if (budget === null) {
    return reached === 0
      ? "No live budget: the engine is not live, so nothing can be spent today."
      : `No live budget now, but the audit shows ${plural(reached, "call")} reached a model today.`;
  }
  const left = Math.max(budget.limit - budget.used, 0);
  return `${count(budget.used)} of ${plural(budget.limit, "live call")} used today (UTC), ${count(left)} left.`;
}

export function outcomeText(byOutcome: Readonly<Record<string, number>>): string {
  const cached = byOutcome["hit"] ?? 0;
  const live = byOutcome["live"] ?? 0;
  const missed = (byOutcome["miss"] ?? 0) + (byOutcome["budget"] ?? 0);
  const failed = Object.entries(byOutcome)
    .filter(([outcome]) => !["hit", "live", "miss", "budget"].includes(outcome))
    .reduce((sum, [, n]) => sum + n, 0);
  const parts = [
    cached > 0 ? `${count(cached)} from the cache` : null,
    live > 0 ? `${count(live)} live` : null,
    missed > 0 ? `${count(missed)} not answered` : null,
    failed > 0 ? `${count(failed)} failed` : null,
  ];
  return parts.filter((part) => part !== null).join(", ");
}

export const REFUSAL_TEXT: Readonly<Record<AdminRefusal, string>> = {
  signed_out: "You are signed out. Sign in as the admin account to see operations and data.",
  forbidden: "This account is not an admin, so the admin routes refused it.",
  not_connected: "The admin routes are not connected yet.",
  error: "The figures could not be loaded.",
};

export const EMPTY_TEXT = {
  noCalls:
    "No model calls recorded on this machine yet. The engine writes one line per model call to its audit; this list fills with the first call.",
  noFailures: "No model call failed on these days.",
  noSources: "No sources are in this snapshot: nothing has been crawled and loaded here.",
  noFlagged: (checked: number) =>
    `No person profile has a name shaped like a company. Checked ${plural(checked, "person profile")}.`,
} as const;
