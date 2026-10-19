import { formatBernDate, formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import { Button } from "@/infrastructure/ui/button";
import { EmptyState } from "@/infrastructure/ui/empty-state";
import { ListRow } from "@/infrastructure/ui/list-row";
import { Sheet } from "@/infrastructure/ui/sheet";
import type { PhoneNotification } from "./phone-types";

const kindLabels: Readonly<Record<string, string>> = {
  message: "Message",
  connection: "Connection",
  loop: "Loop",
  system: "Bern Life",
};

/** "14:05" today in Bern, "Sun 18 Oct, 23:40" on any other day. */
export function notificationTime(at: string, now: Date | null): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const time = formatBernTime(date);
  if (now !== null && formatBernDate(date) === formatBernDate(now)) return time;
  return `${formatBernShortDate(date)}, ${time}`;
}

type NotificationCentreProps = {
  notifications: readonly PhoneNotification[];
  now: Date | null;
  onClose: () => void;
  onOpen?: ((notification: PhoneNotification) => void) | undefined;
  onMarkAllRead?: (() => void) | undefined;
};

export function NotificationCentre({
  notifications,
  now,
  onClose,
  onOpen,
  onMarkAllRead,
}: NotificationCentreProps) {
  const anyUnread = notifications.some((notification) => !notification.read);
  return (
    <Sheet title="Notifications" onClose={onClose}>
      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          text="Messages, connections and loop updates show up here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {anyUnread && onMarkAllRead && (
            <Button variant="ghost" onClick={onMarkAllRead} className="self-end px-2 py-1 text-sm">
              Mark all read
            </Button>
          )}
          <ul>
            {notifications.map((notification) => (
              <ListRow
                key={notification.id}
                leading={
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${notification.read ? "" : "bg-alert"}`}
                  />
                }
                title={
                  <>
                    {!notification.read && <span className="sr-only">Unread: </span>}
                    {notification.title}
                  </>
                }
                description={kindLabels[notification.kind] ?? notification.kind}
                trailing={
                  <span className="text-muted shrink-0 text-xs">
                    {notificationTime(notification.at, now)}
                  </span>
                }
                onClick={onOpen ? () => onOpen(notification) : undefined}
              />
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
