"use client";

import { Canvas } from "@react-three/fiber";
import { type ReactNode, useRef, useState } from "react";
import { shownAgentName } from "@/features/avatar/agent-name";
import type { BearConfig } from "@/features/avatar/bear-config";
import { BearFigure } from "@/features/avatar/bear-figure";
import { motionFor } from "@/features/avatar/bear-motion";
import { LumiFloatie } from "@/features/floatie/lumi-floatie";
import { type LumiApi, httpLumiApi } from "@/features/lumi/lumi-api";
import { LumiChat } from "@/features/lumi/lumi-chat";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

type WorldLumiInput = {
  agentName: string;
  bear: BearConfig;
  lite: boolean;
  /** How the engine answers, from health; null while unknown. */
  engineMode: SearchResponse["mode"] | null;
  fixtureMode: boolean;
  /** The Ask app's Navigator, which shows the answer holding a profile Lumi opens. */
  navigator: Pick<NavigatorController, "show">;
  onShowOnMap: (response: SearchResponse) => void;
  onOpenAsk: () => void;
  /** Saves Lumi's answer as a match report for the desk's Reports window; false when it cannot. */
  onMakeReport: (response: SearchResponse) => boolean;
  /** Opens the desk, where the Reports window shows the report just made. */
  onOpenReports: () => void;
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
// the player would go by hand: the map, Ask, or the desk's Reports window. A report waits for the
// player's click on the reply (features/lumi) and never opens a new tab.
export function useWorldLumi(input: WorldLumiInput): WorldLumi {
  const { agentName, bear, lite, fixtureMode, navigator } = input;
  const [open, setOpen] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);
  const name = shownAgentName(agentName);

  // The phone or the desk opens only once the chat has closed and given focus back to what opened
  // it, so that dialog records a live element to return focus to.
  function closeThen(next: () => void) {
    if (!open) {
      next();
      return;
    }
    afterClose.current = next;
    setOpen(false);
  }

  function closed() {
    setOpen(false);
    const next = afterClose.current;
    afterClose.current = null;
    if (next) queueMicrotask(next);
  }

  function showOnMap(response: SearchResponse) {
    setOpen(false);
    input.onShowOnMap(response);
  }

  // Ask shows the answer that lists the profile, as it came, without asking the engine again.
  function openProfile(_profileId: string, response: SearchResponse) {
    closeThen(() => {
      navigator.show(response);
      input.onOpenAsk();
    });
  }

  function startMatchReport(response: SearchResponse) {
    if (input.onMakeReport(response)) closeThen(input.onOpenReports);
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
        onClose={closed}
        agentName={name}
        fixtureMode={fixtureMode}
        bear={open && <SmallBear config={bear} />}
        engineMode={input.engineMode}
        api={input.api ?? httpLumiApi}
        onShowOnMap={showOnMap}
        onOpenProfile={openProfile}
        onStartMatchReport={startMatchReport}
      />
    ),
  };
}

/** The agent's bear, still and lite, in the chat's header: head and body, 1.4 tall, feet at 0. */
function SmallBear({ config }: { config: BearConfig }) {
  // The default camera looks at the origin, so the bear moves down instead of the camera up.
  return (
    <Canvas
      frameloop="demand"
      dpr={1}
      gl={{ alpha: true }}
      camera={{ position: [0, 0, 2.2], fov: 30 }}
    >
      <hemisphereLight color="#fff8ee" groundColor="#e8d8c0" intensity={1.4} />
      <directionalLight position={[1, 2, 3]} intensity={0.8} />
      <group position={[0, -0.9, 0]}>
        <BearFigure config={config} lite motion="still" />
      </group>
    </Canvas>
  );
}
