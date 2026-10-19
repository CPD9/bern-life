import { answerSourceForHealth, howAnAnswerIsMade } from "@/infrastructure/answer-source";
import type { PhoneHealth } from "./phone-types";

const countFormat = new Intl.NumberFormat("en-GB");

type AboutDataSourcesProps = { health: PhoneHealth | undefined; fixtureMode: boolean };

/** How an answer is made, in the status chip's words; snapshot and counts exactly as health states them. */
export function AboutDataSources({ health, fixtureMode }: AboutDataSourcesProps) {
  const source = answerSourceForHealth(health, fixtureMode);
  const intro = (
    <>
      <h4 className="font-extrabold">How an answer is made</h4>
      <p className="text-sm">{howAnAnswerIsMade.join(" ")}</p>
      {source && (
        <p className="text-sm">
          <strong>Right now: {source.label}.</strong> {source.sentence} {source.explanation}
        </p>
      )}
    </>
  );
  if (health === undefined || health.status === "waiting") return intro;
  if (health.status === "offline") {
    return (
      <>
        {intro}
        <p className="text-sm">
          The snapshot and counts cannot be shown while the search service is not reachable.
        </p>
      </>
    );
  }
  const { snapshot, counts } = health.health;
  const rows: [string, string][] = [["Snapshot", snapshot]];
  if (counts.pages !== undefined) rows.push(["Pages", countFormat.format(counts.pages)]);
  if (counts.profiles !== undefined) rows.push(["Profiles", countFormat.format(counts.profiles)]);
  if (counts.sources !== undefined) rows.push(["Sources", countFormat.format(counts.sources)]);
  return (
    <>
      {intro}
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
