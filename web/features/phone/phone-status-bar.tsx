import { formatBernTime } from "@/infrastructure/bern-time";
import { Badge } from "@/infrastructure/ui/badge";
import { EngineChip } from "./engine-chip";
import type { PhoneHealth } from "./phone-types";

function notificationsLabel(unread: number | undefined): string {
  return unread !== undefined && unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
}

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

export function PhoneStatusBar({
  now,
  health,
  unreadMessages,
  unreadNotifications,
  onOpenNotifications,
  onClose,
}: PhoneStatusBarProps) {
  return (
    <div className="flex min-h-12 items-center gap-2 px-4 pt-2 text-sm">
      {now && (
        <time dateTime={now.toISOString()} className="font-extrabold tabular-nums">
          {formatBernTime(now)}
        </time>
      )}
      <EngineChip health={health} />
      <span className="flex-1" />
      <Badge count={unreadMessages} label="unread messages" dot />
      {onOpenNotifications && (
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={notificationsLabel(unreadNotifications)}
          className="rounded-pill focus-visible:outline-focus relative flex size-9 items-center justify-center focus-visible:outline-3"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
          </svg>
          <span aria-hidden="true" className="absolute top-1 right-1">
            <Badge count={unreadNotifications} label="unread" dot />
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="bg-chip rounded-pill focus-visible:outline-focus px-3 py-1 font-bold focus-visible:outline-3"
      >
        <span aria-hidden="true">✕ </span>Close
      </button>
    </div>
  );
}
