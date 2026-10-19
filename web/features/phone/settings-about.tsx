import type { PhoneHealth } from "./phone-types";

const countFormat = new Intl.NumberFormat("en-GB");

// Every fact is a quoted span on a stored page in every mode; the model only widens the question
// and explains from cited claims. "mock" from a real engine is plain search over the stored pages;
// only the fixture is canned test data.
const modeText = {
  live: "Live: a model widens your question and explains results from the claims they cite.",
  replay: "Replay: model help is replayed from recorded calls.",
  plain: "Plain search: no model is connected, so the stored pages are searched as they are.",
  fixture: "MOCK: fixture data. No model answered, and results are canned test data.",
} as const;

const factsText =
  "Every fact shown is a quoted span on a stored page, with a link to the page it came from.";

type AboutDataSourcesProps = { health: PhoneHealth | undefined; fixtureMode: boolean };

/** Snapshot and counts exactly as health states them; a missing count is left out. */
export function AboutDataSources({ health, fixtureMode }: AboutDataSourcesProps) {
  const intro = (
    <p className="text-sm">
      Bern Life reads public pages of the University of Bern, ARTORG and the Diabetes Center Berne.
      {` ${factsText}`}
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
  const fixture = fixtureMode || snapshot === "fixture";
  const modeLine = mode === "mock" ? modeText[fixture ? "fixture" : "plain"] : modeText[mode];
  const rows: [string, string][] = [["Snapshot", snapshot]];
  if (counts.pages !== undefined) rows.push(["Pages", countFormat.format(counts.pages)]);
  if (counts.profiles !== undefined) rows.push(["Profiles", countFormat.format(counts.profiles)]);
  if (counts.sources !== undefined) rows.push(["Sources", countFormat.format(counts.sources)]);
  return (
    <>
      {intro}
      <p className="text-sm">{modeLine}</p>
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
