"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { AvatarEditor } from "@/features/avatar/avatar-editor";
import { AvatarTurntable } from "@/features/avatar/avatar-turntable";
import { useAvatar } from "@/features/avatar/use-avatar";
import { Onboarding } from "@/features/onboarding/onboarding";
import { browserOnboardingStore, useOnboarding } from "@/features/onboarding/use-onboarding";
import { useSettings } from "@/infrastructure/use-settings";
import { saveToAccount } from "./save-to-account";

// Composes onboarding with the avatar editor, which is another feature. A player who finished
// before starts again at the first step with their answers kept.
export function StartApp() {
  const router = useRouter();
  const [state, dispatch] = useOnboarding();
  const [avatar, setAvatar] = useAvatar();
  const [settings] = useSettings();
  const account = useAccount(httpAccountApi);

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
      onDone={async () => {
        if (account.state.status === "signed-in") {
          await saveToAccount((path, init) => fetch(path, init), state.profile, avatar);
        }
        router.push("/");
      }}
    />
  );
}
