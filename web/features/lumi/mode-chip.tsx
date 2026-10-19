import type { AnswerMode } from "./agent-reply";

// Two rules, in the HUD's words and colours. Health is the engine's state, shown before any reply,
// and says exactly what the HUD says: Live, Replay or MOCK. An answer says how it was made: "mock"
// from the engine is stored pages searched without a model, so it reads "Plain search"; only canned
// fixture answers earn the yellow MOCK.
type ChipKind = AnswerMode | "plain";

const chips: Record<ChipKind, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-chip text-primary" },
  replay: { label: "Replay", className: "bg-chip text-muted" },
  mock: { label: "MOCK", className: "bg-warn-bg text-warn-ink tracking-widest" },
  plain: { label: "Plain search", className: "bg-chip text-muted" },
};

export type ModeChipProps =
  | { readonly source: "health"; readonly mode: AnswerMode }
  | { readonly source: "answer"; readonly mode: AnswerMode; readonly fixtureMode: boolean };

export function ModeChip(props: ModeChipProps) {
  const plain = props.source === "answer" && props.mode === "mock" && !props.fixtureMode;
  const { label, className } = chips[plain ? "plain" : props.mode];
  return (
    <span className={`rounded-pill shrink-0 px-2 py-0.5 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
