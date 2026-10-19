import type { ReactNode } from "react";

type ListRowProps = {
  title: ReactNode;
  description?: ReactNode | undefined;
  /** Before the text: an icon or a dot. */
  leading?: ReactNode | undefined;
  /** After the text: a time, a badge or a control. */
  trailing?: ReactNode | undefined;
  /** Makes the whole row one button. Leave it out when the trailing slot holds a control. */
  onClick?: (() => void) | undefined;
};

const layout = "flex w-full items-center gap-3 px-1 py-3 text-left";

export function ListRow({ title, description, leading, trailing, onClick }: ListRowProps) {
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold break-words">{title}</span>
        {description && <span className="text-muted text-sm break-words">{description}</span>}
      </span>
      {trailing}
    </>
  );
  return (
    <li className="border-panel-border border-b last:border-b-0">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`${layout} focus-visible:outline-focus rounded-xl focus-visible:outline-3`}
        >
          {body}
        </button>
      ) : (
        <div className={layout}>{body}</div>
      )}
    </li>
  );
}
