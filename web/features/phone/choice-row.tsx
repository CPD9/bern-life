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

/**
 * One setting with a few exclusive choices, as an iOS segmented control: a rounded track, the
 * chosen segment lifted in the panel colour with a soft shadow. A radio group underneath.
 */
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
    <fieldset aria-busy={busy} className="flex min-h-11 flex-col gap-2">
      <legend className="pt-1">{title}</legend>
      <p className="text-muted text-sm">{description}</p>
      <div className="bg-chip flex rounded-[9px] p-0.5">
        {choices.map((choice) => (
          <label
            key={String(choice.value)}
            className="has-checked:bg-panel has-checked:shadow-sm has-focus-visible:outline-focus flex h-7 flex-1 cursor-pointer items-center justify-center rounded-[7px] px-2 text-center text-sm has-checked:font-semibold has-focus-visible:outline-3"
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
