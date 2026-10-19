import { answerSourceFor } from "@/infrastructure/answer-source";
import { AnswerSourceChip } from "@/infrastructure/ui/answer-source";
import type { AnswerMode } from "./agent-reply";

// The same words as the HUD and the phone: before any reply the chip reads the engine's health,
// after one it reads how that answer was made. Either way, tapping it explains.
export type ModeChipProps = { readonly mode: AnswerMode; readonly fixtureMode: boolean };

export function ModeChip({ mode, fixtureMode }: ModeChipProps) {
  return <AnswerSourceChip source={answerSourceFor(mode, fixtureMode)} />;
}
