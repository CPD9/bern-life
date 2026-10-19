import { answerSourceForHealth } from "@/infrastructure/answer-source";
import { AnswerSourceChip } from "@/infrastructure/ui/answer-source";
import type { PhoneHealth } from "./phone-types";

type EngineChipProps = { health: PhoneHealth | undefined; fixtureMode?: boolean };

/** One quiet label from health, nothing while health is unknown; tapping it explains. */
export function EngineChip({ health, fixtureMode = false }: EngineChipProps) {
  const source = answerSourceForHealth(health, fixtureMode);
  return (
    <span aria-live="polite" className="contents">
      {source && <AnswerSourceChip source={source} />}
    </span>
  );
}
