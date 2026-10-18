"use client";

import { useId } from "react";

type Choice = { readonly id: string; readonly label: string; readonly colour?: string };

type ChoiceGroupProps<Id extends string> = {
  title: string;
  choices: readonly (Choice & { readonly id: Id })[];
  value: Id;
  onChange: (id: Id) => void;
};

// Swatch groups show only the colour; the label stays for screen readers and as a tooltip.
export function ChoiceGroup<Id extends string>({
  title,
  choices,
  value,
  onChange,
}: ChoiceGroupProps<Id>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-sm font-extrabold">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((choice) => (
          <label
            key={choice.id}
            title={choice.colour ? choice.label : undefined}
            className={
              choice.colour
                ? "has-checked:outline-chip-selected has-focus-visible:outline-focus size-9 cursor-pointer rounded-full outline-offset-2 has-checked:outline-3 has-focus-visible:outline-3"
                : "bg-chip rounded-pill has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus cursor-pointer px-3.5 py-1.5 text-sm font-bold has-focus-visible:outline-3"
            }
            style={choice.colour ? { backgroundColor: choice.colour } : undefined}
          >
            <input
              type="radio"
              name={name}
              checked={value === choice.id}
              onChange={() => onChange(choice.id)}
              className="sr-only"
            />
            <span className={choice.colour ? "sr-only" : undefined}>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
