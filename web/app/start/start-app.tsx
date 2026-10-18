"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { AgentEditor } from "@/features/avatar/agent-editor";
import { shownAgentName } from "@/features/avatar/agent-name";
import { AvatarEditor } from "@/features/avatar/avatar-editor";
import { AvatarTurntable } from "@/features/avatar/avatar-turntable";
import { BearFigure } from "@/features/avatar/bear-figure";
import { useAvatar } from "@/features/avatar/use-avatar";
import { PersonEditor } from "@/features/avatar/person-editor";
import { PersonTurntable } from "@/features/avatar/person-turntable";
import { useAgentName, usePerson } from "@/features/avatar/use-person";
import { Floatie } from "@/features/floatie/floatie";
import { FloatieGreeting } from "@/features/floatie/floatie-greeting";
import { Onboarding } from "@/features/onboarding/onboarding";
import { browserOnboardingStore, useOnboarding } from "@/features/onboarding/use-onboarding";
import { useSettings } from "@/infrastructure/use-settings";
import { saveToAccount } from "./save-to-account";

// Composes onboarding with the avatar editors and Lumi's greeting, which are other features: your
// look is a person, and your first agent is a bear. Lumi wears the agent's bear, the default one
// until the player makes theirs in the last step. A player who finished before starts again at the
// first step with their answers kept. Finishing while signed in also saves them and both looks to
// the account.
export function StartApp() {
  const router = useRouter();
  const [state, dispatch] = useOnboarding();
  const [person, setPerson] = usePerson();
  const [bear, setBear] = useAvatar();
  const [agentName, setAgentName] = useAgentName();
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
        <PersonEditor
          value={person}
          onChange={setPerson}
          preview={<PersonTurntable config={person} lite={settings.lite} />}
        />
      }
      greeting={
        <FloatieGreeting
          name={shownAgentName(agentName)}
          figure={(onSelect) => (
            <Floatie
              name={shownAgentName(agentName)}
              figure={(reducedMotion) => (
                <BearFigure
                  config={bear}
                  lite={settings.lite}
                  motion={reducedMotion ? "still" : "idle"}
                />
              )}
              onSelect={onSelect}
              lite={settings.lite}
            />
          )}
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
      onDone={async () => {
        if (account.state.status === "signed-in") {
          await saveToAccount((path, init) => fetch(path, init), state.profile, {
            person,
            agent: { name: shownAgentName(agentName), bear },
          });
        }
        router.push("/");
      }}
    />
  );
}
