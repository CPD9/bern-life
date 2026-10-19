import type { PhoneHealth } from "./phone-types";

const countFormat = new Intl.NumberFormat("en-GB");

const modeText = {
  live: "Live: answers come from the model the engine is connected to.",
  replay: "Replay: answers are replayed from the stored snapshot, without a model.",
  mock: "MOCK: no model is connected, so answers are fixed examples.",
} as const;

/** Snapshot and counts exactly as health states them; a missing count is left out. */
export function AboutDataSources({ health }: { health: PhoneHealth | undefined }) {
  const intro = (
    <p className="text-sm">
      Bern Life reads public pages of the University of Bern, ARTORG and the Diabetes Center Berne.
      Every fact links to the page it came from.
    </p>
  );
  if (health === undefined || health.status === "waiting") return intro;
  if (health.status === "offline") {
    return (
      <>
        {intro}
        <p className="text-sm">
          The engine is offline, so the snapshot and counts cannot be shown.
        </p>
      </>
    );
  }
  const { mode, snapshot, counts } = health.health;
  const rows: [string, string][] = [["Snapshot", snapshot]];
  if (counts.pages !== undefined) rows.push(["Pages", countFormat.format(counts.pages)]);
  if (counts.profiles !== undefined) rows.push(["Profiles", countFormat.format(counts.profiles)]);
  if (counts.sources !== undefined) rows.push(["Sources", countFormat.format(counts.sources)]);
  return (
    <>
      {intro}
      <p className="text-sm">{modeText[mode]}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="font-bold break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
