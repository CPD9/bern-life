import type { AppNotification, NotificationKind } from "./notification-store";

export const kindLabels: Record<NotificationKind, string> = {
  message: "Message",
  connection: "Connection",
  loop: "Loop",
  system: "Bern Life",
};

/** Kind, title and body; a link when the notification points at a page of the app. */
export function NotificationText({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const title =
    item.href === undefined ? (
      <span className="font-bold">{item.title}</span>
    ) : (
      <a href={item.href} onClick={onOpen} className="font-bold underline underline-offset-2">
        {item.title}
      </a>
    );
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted text-xs font-bold tracking-wide uppercase">
        {kindLabels[item.kind]}
      </span>
      {title}
      <span className="text-sm break-words">{item.body}</span>
    </div>
  );
}
