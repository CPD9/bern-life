"use client";

import { type ReactNode } from "react";
import {
  type BearConfig,
  accessoryOptions,
  faceOptions,
  furOptions,
  kindOptions,
  outfitOptions,
  shuffleBear,
  withKind,
} from "./bear-config";
import { ChoiceGroup } from "./choice-group";

type AvatarEditorProps = {
  value: BearConfig;
  onChange: (next: BearConfig) => void;
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
  const set = <K extends Exclude<keyof BearConfig, "kind">>(key: K) => {
    return (id: BearConfig[K]) => onChange({ ...value, [key]: id });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-2">
      {preview}
      <div className="flex min-w-0 flex-col gap-5">
        <ChoiceGroup
          title="Kind"
          choices={kindOptions}
          value={value.kind}
          onChange={(kind) => onChange(withKind(value, kind))}
        />
        <ChoiceGroup
          title="Fur"
          choices={furOptions(value.kind)}
          value={value.fur}
          onChange={set("fur")}
        />
        <ChoiceGroup title="Face" choices={faceOptions} value={value.face} onChange={set("face")} />
        <ChoiceGroup
          title="Outfit"
          choices={outfitOptions}
          value={value.outfit}
          onChange={set("outfit")}
        />
        <ChoiceGroup
          title="Accessory"
          choices={accessoryOptions}
          value={value.accessory}
          onChange={set("accessory")}
        />
        <button
          type="button"
          onClick={() => onChange(shuffleBear(random))}
          className="bg-chip rounded-pill hover:bg-chip-selected hover:text-chip-selected-ink self-start px-5 py-2 text-sm font-bold"
        >
          Shuffle
        </button>
      </div>
    </div>
  );
}
