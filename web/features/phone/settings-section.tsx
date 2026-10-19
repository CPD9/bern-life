import { type ReactNode, useId } from "react";

type SettingsSectionProps = {
  title: string;
  /** One secondary line under the group, for what the group as a whole means. */
  footer?: string | undefined;
  children: ReactNode;
};

// A grouped inset section: a small uppercase header, then a rounded panel whose direct children
// are the rows, separated by hairlines inset to the text's leading edge, as iOS Settings does.
export function SettingsSection({ title, footer, children }: SettingsSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-muted px-4 text-[13px] font-medium tracking-wide uppercase">
        {title}
      </h3>
      <div className="bg-panel ring-panel-border overflow-hidden rounded-xl ring-1 [&>*]:ml-4 [&>*]:py-2 [&>*]:pr-4 [&>*+*]:border-t [&>*+*]:border-panel-border">
        {children}
      </div>
      {footer && <p className="text-muted px-4 text-sm">{footer}</p>}
    </section>
  );
}
