import { useId } from "react";

export type Choice<T> = { readonly value: T; readonly label: string };

type ChoiceRowProps<T> = {
  title: string;
  description: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  /** A change is being saved: the group says so, and stays focusable. */
  busy?: boolean;
};

/** One setting with a few exclusive choices, as a segmented radio group. */
export function ChoiceRow<T extends string | boolean>({
  title,
  description,
  choices,
  value,
  onChange,
  busy = false,
}: ChoiceRowProps<T>) {
  const name = useId();
  return (
    <fieldset aria-busy={busy} className="flex flex-col gap-2">
      <legend className="pb-1 font-bold">{title}</legend>
      <p className="text-muted text-sm">{description}</p>
      <div className="bg-chip rounded-pill flex gap-1 p-1">
        {choices.map((choice) => (
          <label
            key={String(choice.value)}
            className="rounded-pill has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus flex-1 cursor-pointer px-2 py-1.5 text-center text-sm font-bold has-focus-visible:outline-3"
          >
            <input
              type="radio"
              name={name}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
