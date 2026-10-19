"use client";

import { type ReactNode } from "react";
import { ChoiceGroup } from "./choice-group";
import {
  type PersonConfig,
  accentOptions,
  bodyOptions,
  hairOptions,
  outfitOptions,
  shufflePerson,
  skinOptions,
} from "./person-config";

type PersonEditorProps = {
  value: PersonConfig;
  onChange: (next: PersonConfig) => void;
  /** The 3D view, usually `<PersonTurntable>`; passed in so this form never loads three.js. */
  preview: ReactNode;
  random?: () => number;
};

export function PersonEditor({
  value,
  onChange,
  preview,
  random = Math.random,
}: PersonEditorProps) {
  const set = <K extends keyof PersonConfig>(key: K) => {
    return (id: PersonConfig[K]) => onChange({ ...value, [key]: id });
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
          onClick={() => onChange(shufflePerson(random))}
          className="bg-chip rounded-pill hover:bg-chip-selected hover:text-chip-selected-ink self-start px-5 py-2 text-sm font-bold"
        >
          Shuffle
        </button>
      </div>
    </div>
  );
}
