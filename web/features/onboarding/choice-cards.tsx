import { useId } from "react";

type Card<Id extends string> = { readonly id: Id; readonly label: string; readonly hint?: string };

type ChoiceCardsProps<Id extends string> = {
  legend: string;
  choices: readonly Card<Id>[];
  value: Id | null;
  onChange: (id: Id) => void;
};

export function ChoiceCards<Id extends string>({
  legend,
  choices,
  value,
  onChange,
}: ChoiceCardsProps<Id>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      {choices.map((choice) => (
        <label
          key={choice.id}
          className="bg-chip has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus flex cursor-pointer flex-col gap-0.5 rounded-2xl px-4 py-3 has-focus-visible:outline-3"
        >
          <input
            type="radio"
            name={name}
            checked={value === choice.id}
            onChange={() => onChange(choice.id)}
            className="sr-only"
          />
          <span className="font-bold">{choice.label}</span>
          {choice.hint && <span className="text-sm opacity-80">{choice.hint}</span>}
        </label>
      ))}
    </fieldset>
  );
}
