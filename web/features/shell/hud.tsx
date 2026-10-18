import type { Health } from "@/infrastructure/contract-types.generated";
import { formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import { hudCounts } from "./hud-items";

type HudProps = {
  now: Date | null;
  health: Health | null;
  goal: string;
};

export function Hud({ now, health, goal }: HudProps) {
  const counts = hudCounts(health);
  return (
    <div className="rounded-pill bg-panel shadow-panel border-panel-border flex min-h-12 max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-x-4 gap-y-1 border px-5 py-2 text-sm">
      <h1 className="sr-only text-base font-extrabold tracking-tight sm:not-sr-only">Bern Life</h1>
      {now && (
        <>
          <time dateTime={now.toISOString()} className="font-bold">
            {formatBernShortDate(now)} · {formatBernTime(now)}
          </time>
        </>
      )}
      <span>
        <span className="text-muted">Goal </span>
        <span className="font-bold">{goal}</span>
      </span>
      {counts.length > 0 && (
        <>
          <span className="text-muted">{counts.join(" · ")}</span>
        </>
      )}
      {health?.mode === "mock" && (
        <span className="bg-warn-bg text-warn-ink rounded-pill px-2 py-0.5 text-xs font-bold tracking-widest">
          MOCK
        </span>
      )}
      {health?.mode === "replay" && (
        <span className="bg-chip text-muted rounded-pill px-2 py-0.5 text-xs font-bold">
          Replay
        </span>
      )}
    </div>
  );
}
