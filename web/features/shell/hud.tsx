import type { ReactNode } from "react";
import { formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import { AccountBadge, type HudAccount } from "./account-badge";
import { hudCounts } from "./hud-items";
import type { HealthState } from "./use-health";

type HudProps = {
  now: Date | null;
  health: HealthState;
  goal: string;
  account: HudAccount;
  /** The notification bell; the shell does not know where notifications come from. */
  bell?: ReactNode;
  onOpenYou?: () => void;
};

export function Hud({ now, health, goal, account, bell, onOpenYou }: HudProps) {
  const counts = hudCounts(health.status === "ok" ? health.health : null);
  const mode = health.status === "ok" ? health.health.mode : null;
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
      {mode === "live" && (
        <span className="bg-chip text-primary rounded-pill px-2 py-0.5 text-xs font-bold">
          Live
        </span>
      )}
      {mode === "mock" && (
        <span className="bg-warn-bg text-warn-ink rounded-pill px-2 py-0.5 text-xs font-bold tracking-widest">
          MOCK
        </span>
      )}
      {mode === "replay" && (
        <span className="bg-chip text-muted rounded-pill px-2 py-0.5 text-xs font-bold">
          Replay
        </span>
      )}
      {health.status === "offline" && (
        <span className="bg-warn-bg text-warn-ink rounded-pill px-2 py-0.5 text-xs font-bold">
          Engine offline
        </span>
      )}
      {bell}
      <AccountBadge account={account} onOpen={onOpenYou} />
    </div>
  );
}
