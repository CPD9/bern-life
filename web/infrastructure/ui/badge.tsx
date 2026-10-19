const countFormat = new Intl.NumberFormat("en-GB");

type BadgeProps = {
  /** Nothing renders for 0, a negative number or an unknown (undefined) count. */
  count: number | undefined;
  /** What is counted, for screen readers: "unread messages". */
  label: string;
  /** A plain dot instead of the number, for tight spots like the status bar. */
  dot?: boolean;
  className?: string;
};

export function Badge({ count, label, dot = false, className }: BadgeProps) {
  if (count === undefined || !Number.isFinite(count) || count <= 0) return null;
  const spoken = `${countFormat.format(count)} ${label}`;
  if (dot) {
    return (
      <span
        role="img"
        aria-label={spoken}
        className={`inline-block size-2.5 rounded-full bg-alert ${className ?? ""}`}
      />
    );
  }
  return (
    <span
      className={`rounded-pill inline-flex min-w-5 items-center justify-center bg-alert px-1.5 text-xs leading-5 font-extrabold text-white ${className ?? ""}`}
    >
      <span aria-hidden="true">{count > 99 ? "99+" : countFormat.format(count)}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
