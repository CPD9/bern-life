"use client";

import { type ReactNode, useId } from "react";
import {
  type AvatarConfig,
  accentOptions,
  bodyOptions,
  hairOptions,
  outfitOptions,
  shuffleAvatar,
  skinOptions,
} from "./avatar-config";

type Choice = { readonly id: string; readonly label: string; readonly colour?: string };

type ChoiceGroupProps<Id extends string> = {
  title: string;
  choices: readonly (Choice & { readonly id: Id })[];
  value: Id;
  onChange: (id: Id) => void;
};

// Swatch groups show only the colour; the label stays for screen readers and as a tooltip.
function ChoiceGroup<Id extends string>({ title, choices, value, onChange }: ChoiceGroupProps<Id>) {
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

type AvatarEditorProps = {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  /** The 3D view, usually `<AvatarTurntable>`; passed in so this form never loads three.js. */
  preview: ReactNode;
  random?: () => number;
};

export function AvatarEditor({
  value,
  onChange,
  preview,
  random = Math.random,
}: AvatarEditorProps) {
  const set = <K extends keyof AvatarConfig>(key: K) => {
    return (id: AvatarConfig[K]) => onChange({ ...value, [key]: id });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-2">
      {preview}
      <div className="flex min-w-0 flex-col gap-5">
        <ChoiceGroup title="Body" choices={bodyOptions} value={value.body} onChange={set("body")} />
        <ChoiceGroup
          title="Skin tone"
          choices={skinOptions}
          value={value.skin}
          onChange={set("skin")}
        />
        <ChoiceGroup title="Hair" choices={hairOptions} value={value.hair} onChange={set("hair")} />
        <ChoiceGroup
          title="Outfit"
          choices={outfitOptions}
          value={value.outfit}
          onChange={set("outfit")}
        />
        <ChoiceGroup
          title="Accent colour"
          choices={accentOptions}
          value={value.accent}
          onChange={set("accent")}
        />
        <button
          type="button"
          onClick={() => onChange(shuffleAvatar(random))}
          className="bg-chip rounded-pill hover:bg-chip-selected hover:text-chip-selected-ink self-start px-5 py-2 text-sm font-bold"
        >
          Shuffle
        </button>
      </div>
    </div>
  );
}
