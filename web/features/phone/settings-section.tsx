import { type ReactNode, useId } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-panel-border flex flex-col gap-4 border-b pb-6">
      <h3 id={id} className="text-muted text-xs font-extrabold tracking-widest uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
