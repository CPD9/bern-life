"use client";

import type { NightMode } from "@/infrastructure/settings";
import { Toggle } from "@/infrastructure/ui/toggle";
import { useSettings } from "@/infrastructure/use-settings";
import { type Choice, ChoiceRow } from "./choice-row";
import type { PhoneHealth } from "./phone-types";
import { httpProfileApi, type ProfileApi } from "./profile-api";
import { AboutDataSources } from "./settings-about";
import { AccountSettings } from "./settings-account";
import { SettingsSection } from "./settings-section";

const nightChoices: readonly Choice<NightMode>[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
  { value: "auto", label: "Auto" },
];

type SettingsAppProps = {
  /** The account and profile routes; tests pass a fake. */
  profileApi?: ProfileApi | undefined;
  /** Snapshot, counts and mode for "About & data sources"; left out, only the intro shows. */
  health?: PhoneHealth | undefined;
  signInHref?: string | undefined;
  /** DEMO_FIXTURES: a "mock" engine is then the fixture, said as MOCK. */
  fixtureMode?: boolean | undefined;
};

export function SettingsApp({
  profileApi = httpProfileApi,
  health,
  signInHref = "/account",
  fixtureMode = false,
}: SettingsAppProps) {
  const [settings, setSettings] = useSettings();

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="Account and privacy">
        <AccountSettings api={profileApi} signInHref={signInHref} />
      </SettingsSection>
      <SettingsSection title="Notifications">
        <Toggle
          label="In the app"
          description="Shown here while you use Bern Life."
          checked
          disabled
          onChange={() => undefined}
        />
        <Toggle
          label="Push"
          description="Not available yet."
          checked={false}
          disabled
          onChange={() => undefined}
        />
        <Toggle
          label="Email"
          description="Not available yet."
          checked={false}
          disabled
          onChange={() => undefined}
        />
      </SettingsSection>
      <SettingsSection title="Display">
        <ChoiceRow
          title="Night mode"
          description="Darker colours for the evening. Auto follows your device."
          choices={nightChoices}
          value={settings.night}
          onChange={(night) => setSettings({ ...settings, night })}
        />
        <Toggle
          label="Lite graphics"
          description="The map drops shadows and effects, for older laptops and phones."
          checked={settings.lite}
          onChange={(lite) => setSettings({ ...settings, lite })}
        />
        <p className="text-muted text-sm">Saved on this device only.</p>
      </SettingsSection>
      <SettingsSection title="About & data sources">
        <AboutDataSources health={health} fixtureMode={fixtureMode} />
      </SettingsSection>
    </div>
  );
}
