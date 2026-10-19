// In fixture mode an answer is invented sample data and earns the banner; from the engine it is
// stored pages, which one quiet sentence with its "Why?" says.
import { answerSourceFor } from "@/infrastructure/answer-source";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AnswerSourceLine, SampleDataBanner } from "@/infrastructure/ui/answer-source";

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
