import { StatusChip, type StatusTone } from "@/infrastructure/ui/status-chip";
import type { PhoneHealth } from "./phone-types";

/** What the engine chip says, straight from health; nothing while health is unknown. */
export function engineChip(
  health: PhoneHealth | undefined,
): { label: string; tone: StatusTone } | null {
  if (health === undefined || health.status === "waiting") return null;
  if (health.status === "offline") return { label: "Engine offline", tone: "warn" };
  const { mode } = health.health;
  if (mode === "live") return { label: "Live", tone: "ok" };
  if (mode === "replay") return { label: "Replay", tone: "neutral" };
  return { label: "MOCK", tone: "warn" };
}

export function EngineChip({ health }: { health: PhoneHealth | undefined }) {
  const chip = engineChip(health);
  return (
    <span aria-live="polite" className="contents">
      {chip && <StatusChip tone={chip.tone}>{chip.label}</StatusChip>}
    </span>
  );
}
