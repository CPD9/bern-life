import type { ReactNode } from "react";

export type StatusTone = "ok" | "neutral" | "warn";

const tones: Record<StatusTone, string> = {
  ok: "bg-chip text-primary",
  neutral: "bg-chip text-muted",
  warn: "bg-warn-bg text-warn-ink",
};

export function StatusChip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>
  );
}
