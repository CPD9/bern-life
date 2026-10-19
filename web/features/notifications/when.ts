import { formatBernDate, formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";

/** "14:05" today in Bern, "Sun 18 Oct, 23:40" on any other day. */
export function formatWhen(at: string, now: Date): string {
  const date = new Date(at);
  const time = formatBernTime(date);
  if (formatBernDate(date) === formatBernDate(now)) return time;
  return `${formatBernShortDate(date)}, ${time}`;
}
