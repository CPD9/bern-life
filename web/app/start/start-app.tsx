"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AgentEditor } from "@/features/avatar/agent-editor";
import { AvatarEditor } from "@/features/avatar/avatar-editor";
import { AvatarTurntable } from "@/features/avatar/avatar-turntable";
import { useAvatar } from "@/features/avatar/use-avatar";
import { PersonEditor } from "@/features/avatar/person-editor";
import { PersonTurntable } from "@/features/avatar/person-turntable";
import { useAgentName, usePerson } from "@/features/avatar/use-person";
import { Onboarding } from "@/features/onboarding/onboarding";
import { browserOnboardingStore, useOnboarding } from "@/features/onboarding/use-onboarding";
import { useSettings } from "@/infrastructure/use-settings";

// Composes onboarding with the avatar editors, which are another feature: your look is a person,
// and your first agent is a bear. A player who finished
// before starts again at the first step with their answers kept.
export function StartApp() {
  const router = useRouter();
  const [state, dispatch] = useOnboarding();
  const [person, setPerson] = usePerson();
  const [bear, setBear] = useAvatar();
  const [agentName, setAgentName] = useAgentName();
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
        <PersonEditor
          value={person}
          onChange={setPerson}
          preview={<PersonTurntable config={person} lite={settings.lite} />}
        />
      }
      agentStep={
        <AgentEditor
          name={agentName}
          onNameChange={setAgentName}
          bearEditor={
            <AvatarEditor
              value={bear}
              onChange={setBear}
              preview={<AvatarTurntable config={bear} lite={settings.lite} />}
            />
          }
        />
      }
      onDone={() => router.push("/")}
    />
  );
}
