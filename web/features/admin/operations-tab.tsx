import type { AdminActivity, Health } from "@/infrastructure/contract-types.generated";
import { StatusChip } from "@/infrastructure/ui/status-chip";
import {
  EMPTY_TEXT,
  MODE_TEXT,
  budgetText,
  count,
  formatDay,
  formatUptime,
  outcomeText,
} from "./admin-text";
import { Figure, Section } from "./admin-layout";

const SHOWN_DAYS = 7;

type OperationsTabProps = { health: Health | null; activity: AdminActivity };

// Engine mode and health, then the model calls: today's against the budget, the last days as a
// bar list, the failures by marker. Health is null while it is still loading or refused; the
// activity has its own refusal screen, so here it is always there.
export function OperationsTab({ health, activity }: OperationsTabProps) {
  const days = activity.days.slice(0, SHOWN_DAYS);
  const most = Math.max(...days.map((day) => day.calls), 1);
  const failures = Object.entries(activity.failures);
  return (
    <>
      <Section title="Engine">
        {health === null ? (
          <p className="text-muted text-sm">{"The engine's health is not loaded."}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <StatusChip tone={health.status === "degraded" ? "warn" : "ok"}>
                {health.status === "degraded" ? "Degraded" : "OK"}
              </StatusChip>
              <span>{MODE_TEXT[health.mode]}</span>
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Figure label="Snapshot" value={health.snapshot} />
              <Figure label="Pages" value={count(health.counts.pages ?? 0)} />
              <Figure label="Profiles" value={count(health.counts.profiles ?? 0)} />
              <Figure
                label="Up for"
                value={health.uptime_s === undefined ? "unknown" : formatUptime(health.uptime_s)}
              />
            </dl>
          </>
        )}
      </Section>
      <Section title="Live calls today">
        <p>{budgetText(activity)}</p>
        {activity.budget !== null && activity.budget.limit > 0 && (
          <Bar
            label="Live calls used today"
            value={activity.budget.used}
            of={activity.budget.limit}
          />
        )}
      </Section>
      <Section title="Model calls per day">
        {days.length === 0 ? (
          <p className="text-muted text-sm">{EMPTY_TEXT.noCalls}</p>
        ) : (
          <ul aria-label="Model calls per day" className="flex flex-col gap-3">
            {days.map((day) => (
              <li key={day.day} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">{formatDay(day.day)}</span>
                  <span className="tabular-nums">{count(day.calls)} calls</span>
                </div>
                <Bar label={`Calls on ${formatDay(day.day)}`} value={day.calls} of={most} />
                <p className="text-muted text-sm">{outcomeText(day.by_outcome)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Failed calls by marker">
        {failures.length === 0 ? (
          <p className="text-muted text-sm">{EMPTY_TEXT.noFailures}</p>
        ) : (
          <dl
            aria-label="Failed calls by marker"
            className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4"
          >
            {failures.map(([marker, n]) => (
              <Figure key={marker} label={marker} value={count(n)} />
            ))}
          </dl>
        )}
      </Section>
    </>
  );
}

function Bar({ label, value, of }: { label: string; value: number; of: number }) {
  const share = Math.min(Math.max(value / of, 0), 1);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={Math.min(value, of)}
      className="bg-chip h-2 w-full overflow-hidden rounded-full"
    >
      <div className="bg-primary h-full rounded-full" style={{ width: `${share * 100}%` }} />
    </div>
  );
}
