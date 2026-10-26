import { type ReactNode, useId } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-lg font-extrabold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One labelled number or word in a description list. */
export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="font-bold break-words tabular-nums">{value}</dd>
    </div>
  );
}
