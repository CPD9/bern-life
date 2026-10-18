"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AvatarEditor } from "@/features/avatar/avatar-editor";
import { AvatarTurntable } from "@/features/avatar/avatar-turntable";
import { useAvatar } from "@/features/avatar/use-avatar";
import { Floatie } from "@/features/floatie/floatie";
import { FloatieGreeting } from "@/features/floatie/floatie-greeting";
import { Onboarding } from "@/features/onboarding/onboarding";
import { browserOnboardingStore, useOnboarding } from "@/features/onboarding/use-onboarding";
import { useSettings } from "@/infrastructure/use-settings";

// Composes onboarding with the avatar editor and Lumi's greeting, which are other features. A player who finished
// before starts again at the first step with their answers kept.
export function StartApp() {
  const router = useRouter();
  const [state, dispatch] = useOnboarding();
  const [avatar, setAvatar] = useAvatar();
  const [settings] = useSettings();

  // Only on arrival: `dispatch` is stable, and a later `done` comes from finishing, which leaves.
  useEffect(() => {
    if (browserOnboardingStore().get().done) dispatch({ type: "reopen" });
  }, [dispatch]);

  return (
    <Onboarding
      state={state}
      dispatch={dispatch}
      lookStep={
        <AvatarEditor
          value={avatar}
          onChange={setAvatar}
          preview={<AvatarTurntable config={avatar} lite={settings.lite} />}
        />
      }
      greeting={
        <FloatieGreeting
          figure={(onSelect) => <Floatie onSelect={onSelect} lite={settings.lite} />}
        />
      }
      onDone={() => router.push("/")}
    />
  );
}
