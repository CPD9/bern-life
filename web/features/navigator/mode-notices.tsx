// "mock" means two things: in fixture mode the answer is invented sample data, while from the
// engine it is real stored pages searched with the visitor's words. Only the first earns a banner;
// everything else is one quiet sentence with its "Why?".
import { answerSourceFor } from "@/infrastructure/answer-source";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AnswerSourceLine, SampleDataBanner } from "@/infrastructure/ui/answer-source";

export function FixtureLabel() {
  return (
    <span className="border-panel-border text-muted rounded-pill border px-3 py-1 text-xs font-bold tracking-wide">
      Sample data
    </span>
  );
}

export function ModeNotice({
  mode,
  fixtureMode,
}: {
  mode: SearchResponse["mode"];
  fixtureMode: boolean;
}) {
  if (fixtureMode) return <SampleDataBanner />;
  return <AnswerSourceLine source={answerSourceFor(mode, false)} />;
}
