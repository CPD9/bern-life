import type { AnswerMode } from "./agent-reply";

// The HUD's words and colours. "mock" from the engine is real stored pages searched without a
// model, so it says "Plain search"; only canned fixture answers earn the yellow MOCK.
const chips: Record<AnswerMode | "fixture", { label: string; className: string }> = {
  live: { label: "Live", className: "bg-chip text-primary" },
  replay: { label: "Replay", className: "bg-chip text-muted" },
  mock: { label: "Plain search", className: "bg-chip text-muted" },
  fixture: { label: "MOCK", className: "bg-warn-bg text-warn-ink tracking-widest" },
};

export function ModeChip({ mode, fixtureMode }: { mode: AnswerMode; fixtureMode: boolean }) {
  const { label, className } = chips[mode === "mock" && fixtureMode ? "fixture" : mode];
  return (
    <span className={`rounded-pill shrink-0 px-2 py-0.5 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
