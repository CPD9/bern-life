import type { ReactNode } from "react";

type EmptyStateProps = { title: string; text?: string | undefined; action?: ReactNode };

export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-base font-extrabold">{title}</p>
      {text && <p className="text-muted text-sm">{text}</p>}
      {action}
    </div>
  );
}
