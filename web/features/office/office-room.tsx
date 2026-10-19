"use client";

// Your office, where you land after onboarding: a warm room seen from above at an angle, with Lumi
// by the desk. Clicking the desk or computer sits you down at it; the door takes you outside. Both
// are also real buttons below the room, so the keyboard and screen readers reach them. The canvas
// renders only when something changes, and under reduced motion nothing moves at all.

import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { type ReactNode, useState } from "react";
import { type BearConfig } from "@/features/avatar/bear-config";
import { BearFigure } from "@/features/avatar/bear-figure";
import { motionFor } from "@/features/avatar/bear-motion";
import { type HotspotId, hotspot } from "./hotspot";
import { Bookshelf, Chair, Desk, Picture, Plant } from "./office-furniture";
import { CAMERA_POSITION, LOOK_AT, LUMI_SPOT, PLAYER_SPOT, fitZoom } from "./office-layout";
import { Ball, Column, OfficeQualityProvider, officeQuality } from "./office-parts";
import { OfficeShell } from "./office-shell";

/** Lumi until the player's own agent is passed in. */
export const LUMI: BearConfig = {
  kind: "brown-bear",
  fur: "honey",
  face: "happy",
  outfit: "office",
  accessory: "scarf",
};

type RoomLook = {
  lite: boolean;
  reducedMotion: boolean;
  /** The player's figure, standing on the rug; a plain stand-in when absent. */
  player?: ReactNode;
  /** The player's agent bear; Lumi's default look when absent. */
  agent?: BearConfig;
};

/** Your own office: the desk sits you down, the door takes you outside. */
type OwnRoom = { visiting?: undefined; onUseDesk: () => void; onGoOutside: () => void };

/** Someone else's office, read-only: named for its owner, nothing in it does anything. */
type VisitedRoom = { visiting: string; onUseDesk?: undefined; onGoOutside?: undefined };

export type OfficeRoomProps = RoomLook & (OwnRoom | VisitedRoom);

const still = () => undefined;

function FitCamera() {
  const size = useThree((state) => state.size);
  return (
    <OrthographicCamera
      makeDefault
      position={CAMERA_POSITION}
      zoom={fitZoom(size.width, size.height)}
      near={0.1}
      far={60}
      onUpdate={(camera) => camera.lookAt(...LOOK_AT)}
    />
  );
}

function Lights({ shadows }: { shadows: boolean }) {
  return (
    <group>
      <hemisphereLight color="#fff6ea" groundColor="#c9b39b" intensity={1.5} />
      <directionalLight
        position={[4, 8, 5]}
        color="#fff0dc"
        intensity={1.7}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0005}
      />
      {/* A soft fill from the viewer's side, so faces turned toward the camera stay lit. */}
      <directionalLight position={[6, 3, 8]} intensity={0.5} />
    </group>
  );
}

/** A neutral person-shaped stand-in: no face, no clothes, nobody in particular. */
function StandIn() {
  return (
    <group>
      <Column radius={0.2} top={0.15} height={0.86} position={[0, 0, 0]} colour="#a9b2bc" />
      <Ball radius={0.17} position={[0, 1.07, 0]} colour="#d7d2cb" />
    </group>
  );
}

export function OfficeRoom({
  lite,
  reducedMotion,
  player,
  agent = LUMI,
  visiting,
  onUseDesk = still,
  onGoOutside = still,
}: OfficeRoomProps) {
  const [pointed, setPointed] = useState<HotspotId | null>(null);
  const point = visiting === undefined ? setPointed : still;
  const quality = officeQuality(lite);
  const motion = motionFor("idle", { reducedMotion, lite });

  return (
    <div className="relative isolate flex size-full flex-col">
      <div
        role="img"
        aria-label={
          visiting === undefined
            ? "Your office: a desk with a computer and your agent beside it, a bookshelf, a plant, a window and the door"
            : `${visiting}'s office, as a visitor sees it: a desk with a computer and their agent beside it, a bookshelf, a plant, a window and the door`
        }
        className={`min-h-0 flex-1 ${pointed === null ? "" : "cursor-pointer"}`}
      >
        {/* Shadows and pixel ratio are fixed when the renderer is created, so lite mode remounts it. */}
        <Canvas
          key={lite ? "lite" : "full"}
          frameloop="demand"
          shadows={quality.shadows}
          dpr={lite ? 1 : [1, 2]}
          gl={{ alpha: true }}
        >
          <FitCamera />
          <Lights shadows={quality.shadows} />
          <OfficeQualityProvider value={quality}>
            <OfficeShell doorGlow={pointed === "door"} door={hotspot("door", onGoOutside, point)} />
            <Desk glow={pointed === "desk"} handlers={hotspot("desk", onUseDesk, point)} />
            <Chair />
            <Bookshelf />
            <Plant />
            <Picture />
            <group position={[PLAYER_SPOT.x, 0, PLAYER_SPOT.z]} rotation-y={0.5}>
              {player ?? <StandIn />}
            </group>
          </OfficeQualityProvider>
          <group position={[LUMI_SPOT.x, 0, LUMI_SPOT.z]} rotation-y={-0.6}>
            <BearFigure config={agent} lite={lite} motion={motion} />
          </group>
        </Canvas>
      </div>
      {visiting === undefined && (
        <div className="flex flex-wrap justify-center gap-2 p-4">
          <button
            type="button"
            onClick={onUseDesk}
            className="bg-primary text-primary-ink rounded-pill px-5 py-2.5 font-extrabold"
          >
            Use the computer
          </button>
          <button
            type="button"
            data-office-exit
            onClick={onGoOutside}
            className="bg-chip rounded-pill px-5 py-2.5 font-bold"
          >
            Go outside
          </button>
        </div>
      )}
    </div>
  );
}
