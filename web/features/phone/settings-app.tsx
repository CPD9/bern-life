"use client";

import { useId } from "react";
import type { NightMode, Settings } from "@/infrastructure/settings";
import { useSettings } from "@/infrastructure/use-settings";

type Choice<T> = { value: T; label: string };

type SettingRowProps<T> = {
  title: string;
  description: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

function SettingRow<T extends string | boolean>({
  title,
  description,
  choices,
  value,
  onChange,
}: SettingRowProps<T>) {
  const name = useId();
  return (
    <fieldset className="border-panel-border flex flex-col gap-2 border-b pb-5">
      <legend className="pb-1 text-base font-extrabold">{title}</legend>
      <p className="text-muted text-sm">{description}</p>
      <div className="bg-chip rounded-pill flex gap-1 p-1">
        {choices.map((choice) => (
          <label
            key={String(choice.value)}
            className="rounded-pill has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus flex-1 cursor-pointer py-1.5 text-center text-sm font-bold has-focus-visible:outline-3"
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

const nightChoices: readonly Choice<NightMode>[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
  { value: "auto", label: "Auto" },
];

const switchChoices: readonly Choice<boolean>[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

export function SettingsApp() {
  const [settings, setSettings] = useSettings();
  const update = (change: Partial<Settings>) => setSettings({ ...settings, ...change });

  return (
    <div className="flex flex-col gap-5">
      <SettingRow
        title="Night mode"
        description="Darker colours for the evening. Auto follows your device."
        choices={nightChoices}
        value={settings.night}
        onChange={(night) => update({ night })}
      />
      <SettingRow
        title="Lite graphics"
        description="The map drops shadows and effects, for older laptops and phones."
        choices={switchChoices}
        value={settings.lite}
        onChange={(lite) => update({ lite })}
      />
      <SettingRow
        title="Data saver"
        description="The map loads smaller models and nothing plays by itself."
        choices={switchChoices}
        value={settings.dataSaver}
        onChange={(dataSaver) => update({ dataSaver })}
      />
      <p className="text-muted text-sm">Saved on this device only.</p>
    </div>
  );
}
