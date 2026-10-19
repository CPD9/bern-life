"use client";

import { Canvas } from "@react-three/fiber";
import { type ReactNode, useState } from "react";
import { shownAgentName } from "@/features/avatar/agent-name";
import type { BearConfig } from "@/features/avatar/bear-config";
import { BearFigure } from "@/features/avatar/bear-figure";
import { motionFor } from "@/features/avatar/bear-motion";
import { LumiFloatie } from "@/features/floatie/lumi-floatie";
import { type LumiApi, httpLumiApi } from "@/features/lumi/lumi-api";
import { LumiChat } from "@/features/lumi/lumi-chat";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import { openReport } from "@/features/report/open-report";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { rememberingLumiApi } from "./lumi-handoff";

type WorldLumiInput = {
  agentName: string;
  bear: BearConfig;
  lite: boolean;
  /** How the engine answers, from health; null while unknown. */
  engineMode: SearchResponse["mode"] | null;
  fixtureMode: boolean;
  /** The Ask app's Navigator, which shows a profile Lumi opens. */
  navigator: NavigatorController;
  /** Gives Lumi's answer to the Navigator so Ask shows it without asking the engine again. */
  handOver: (response: SearchResponse) => void;
  onShowOnMap: (response: SearchResponse) => void;
  onOpenAsk: () => void;
  api?: LumiApi;
};

export type WorldLumi = {
  open: () => void;
  /** Lumi floating beside the player, in the office and on the map. */
  floatie: ReactNode;
  /** The chat, kept mounted so the conversation survives closing it. */
  chat: ReactNode;
};

// Lumi in the world: the floatie and the bear on the map open one chat. Lumi's actions go where
// the player would go by hand: the map, Ask, or a new match report.
export function useWorldLumi(input: WorldLumiInput): WorldLumi {
  const { agentName, bear, lite, fixtureMode, navigator } = input;
  const [open, setOpen] = useState(false);
  const [api] = useState(() => rememberingLumiApi(input.api ?? httpLumiApi));
  const name = shownAgentName(agentName);

  function showOnMap(response: SearchResponse) {
    setOpen(false);
    input.onShowOnMap(response);
  }

  // Ask shows the answer that lists the profile; with no such answer the chat stays as it is.
  function openProfile(profileId: string) {
    const answer = api.answerListing(profileId);
    if (answer === null) return;
    setOpen(false);
    input.handOver(answer);
    navigator.search({ query: answer.query });
    input.onOpenAsk();
  }

  return {
    open: () => setOpen(true),
    floatie: (
      <LumiFloatie
        name={name}
        figure={(reducedMotion) => (
          <BearFigure
            config={bear}
            lite={lite}
            motion={motionFor("idle", { reducedMotion, lite })}
          />
        )}
        onOpen={() => setOpen(true)}
        state={open ? "listening" : "idle"}
        lite={lite}
      />
    ),
    chat: (
      <LumiChat
        open={open}
        onClose={() => setOpen(false)}
        agentName={name}
        bear={open && <SmallBear config={bear} />}
        engineMode={input.engineMode}
        api={api}
        onShowOnMap={showOnMap}
        onOpenProfile={openProfile}
        onStartMatchReport={(response) => void openReport(response, fixtureMode)}
      />
    ),
  };
}

/** The agent's bear, still and lite, in the chat's header. */
function SmallBear({ config }: { config: BearConfig }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={1}
      gl={{ alpha: true }}
      camera={{ position: [0, 0.75, 2.5], fov: 30 }}
    >
      <hemisphereLight color="#fff8ee" groundColor="#e8d8c0" intensity={1.4} />
      <directionalLight position={[1, 2, 3]} intensity={0.8} />
      <BearFigure config={config} lite motion="still" />
    </Canvas>
  );
}
