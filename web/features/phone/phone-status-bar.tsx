import { formatBernTime } from "@/infrastructure/bern-time";
import { Badge } from "@/infrastructure/ui/badge";
import { EngineChip } from "./engine-chip";
import type { PhoneHealth } from "./phone-types";

function notificationsLabel(unread: number | undefined): string {
  return unread !== undefined && unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
}

const target =
  "rounded-pill focus-visible:outline-focus relative flex size-11 shrink-0 items-center justify-center focus-visible:outline-3";

type PhoneStatusBarProps = {
  now: Date | null;
  health: PhoneHealth | undefined;
  unreadMessages: number | undefined;
  /** Unread notifications; undefined when the phone was given no notification list. */
  unreadNotifications: number | undefined;
  /** Opens the notification centre; no bell without it. */
  onOpenNotifications: (() => void) | undefined;
  onClose: () => void;
};

// The 44 pt status bar: the time at the left, then the quiet engine label, the unread dot, the
// bell and Close at the right, each a 44 pt target. Translucent, no border.
export function PhoneStatusBar({
  now,
  health,
  unreadMessages,
  unreadNotifications,
  onOpenNotifications,
  onClose,
}: PhoneStatusBarProps) {
  return (
    <div className="bg-panel/80 relative z-10 flex h-11 shrink-0 items-center gap-1 pr-1 pl-4 backdrop-blur-md">
      {now && (
        <time dateTime={now.toISOString()} className="text-[15px] font-semibold tabular-nums">
          {formatBernTime(now)}
        </time>
      )}
      <span className="flex-1" />
      <EngineChip health={health} />
      <Badge count={unreadMessages} label="unread messages" dot className="mx-1" />
      {onOpenNotifications && (
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={notificationsLabel(unreadNotifications)}
          className={target}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
          </svg>
          <span aria-hidden="true" className="absolute top-2 right-2">
            <Badge count={unreadNotifications} label="unread" dot />
          </span>
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Close" className={target}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
          <circle cx="12" cy="12" r="10" className="fill-chip" />
          <path
            d="M8.5 8.5l7 7M15.5 8.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
