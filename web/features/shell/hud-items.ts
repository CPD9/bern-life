import type { Health } from "@/infrastructure/contract-types.generated";

const countFormat = new Intl.NumberFormat("en-GB");

/** Only counts the health response states; anything missing is left out, never filled in. */
export function hudCounts(health: Health | null): string[] {
  if (health === null) return [];
  const { profiles, sources } = health.counts;
  const counts: string[] = [];
  if (profiles !== undefined) counts.push(`${countFormat.format(profiles)} profiles indexed`);
  if (sources !== undefined) {
    counts.push(`${countFormat.format(sources)} ${sources === 1 ? "source" : "sources"}`);
  }
  return counts;
}
