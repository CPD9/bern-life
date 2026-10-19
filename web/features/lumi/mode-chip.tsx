import type { AnswerMode } from "./agent-reply";

// The same words and colours as the HUD, so the panel and the HUD never disagree in how they say it.
const chips: Record<AnswerMode, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-chip text-primary" },
  replay: { label: "Replay", className: "bg-chip text-muted" },
  mock: { label: "MOCK", className: "bg-warn-bg text-warn-ink tracking-widest" },
};

export function ModeChip({ mode }: { mode: AnswerMode }) {
  const { label, className } = chips[mode];
  return (
    <span className={`rounded-pill shrink-0 px-2 py-0.5 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
