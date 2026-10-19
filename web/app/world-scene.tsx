"use client";

import { useEffect, useMemo, useRef } from "react";
import { shownAgentName } from "@/features/avatar/agent-name";
import type { BearConfig } from "@/features/avatar/bear-config";
import { BearFigure } from "@/features/avatar/bear-figure";
import { motionFor } from "@/features/avatar/bear-motion";
import type { PersonConfig } from "@/features/avatar/person-config";
import { PersonFigure } from "@/features/avatar/person-figure";
import { OfficeView } from "@/features/office/office-view";
import type { Plot } from "@/features/settle/plots";
import type { WorldView } from "@/features/shell/game-shell";
import type { Building } from "@/features/world/buildings";
import { HOME_DOOR_KEY } from "@/features/world/doors";
import type { MapPoint } from "@/features/world/geography";
import { WorldCanvas } from "@/features/world/world-canvas";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

type WorldSceneProps = {
  view: WorldView;
  demoSearch: SearchResponse | undefined;
  person: PersonConfig;
  bear: BearConfig;
  agentName: string;
  /** Your office plot on this device; null before you settle. */
  plot: Plot | null;
  lite: boolean;
  reducedMotion: boolean;
  onAgentOpen: () => void;
  onSearchHere: (building: Building) => void;
  onPlacePanel: (open: boolean) => void;
  onUseDesk: () => void;
  onGoOutside: () => void;
  onGoHome: () => void;
};

/** Which way you last went through your office door, until focus has followed you through it. */
type Passage = "in" | "out";

/**
 * Where focus lands on the other side of the door: going in, the office's way back out; coming
 * out, "Go home" at the door you stand at, else the Walk button.
 */
function landing(passage: Passage): HTMLElement | null {
  if (passage === "in") return document.querySelector<HTMLElement>("[data-office-exit]");
  return (
    document.querySelector<HTMLElement>(`[data-door="${HOME_DOOR_KEY}"]`) ??
    document.querySelector<HTMLElement>("[data-walk-toggle]")
  );
}

// The map always, with the office over it on Home: the player is a person, the agent a bear. On the
// map you walk from your office door with your agent beside you; at home you stand on the rug.
export function WorldScene({
  view,
  person,
  bear,
  agentName,
  plot,
  lite,
  ...props
}: WorldSceneProps) {
  const { reducedMotion, onGoHome, onGoOutside } = props;
  const home = useMemo((): MapPoint | null => (plot === null ? null : [plot.x, plot.z]), [plot]);
  // The button you pressed is gone with the view it was in, so focus is moved on deliberately.
  const passage = useRef<Passage | null>(null);
  useEffect(() => {
    const through = passage.current;
    if (through === null || view !== (through === "in" ? "home" : "map")) return;
    passage.current = null;
    landing(through)?.focus();
  }, [view]);
  const goHome = () => {
    passage.current = "in";
    onGoHome();
  };
  const goOutside = () => {
    passage.current = "out";
    onGoOutside();
  };
  const moving = (walking: boolean, liteFigure: boolean) =>
    motionFor(walking ? "walk" : "still", { reducedMotion, lite: liteFigure });
  return (
    <>
      <WorldCanvas
        demoSearch={props.demoSearch}
        agent={{
          name: shownAgentName(agentName),
          figure: (liteFigure, walking) => (
            <BearFigure config={bear} lite={liteFigure} motion={moving(walking, liteFigure)} />
          ),
        }}
        player={{
          figure: (liteFigure, walking) => (
            <PersonFigure
              config={person}
              shadows={!liteFigure}
              motion={moving(walking, liteFigure)}
            />
          ),
          home,
          inside: view === "home",
        }}
        onAgentOpen={props.onAgentOpen}
        onSearchHere={props.onSearchHere}
        onPlacePanel={props.onPlacePanel}
        onGoHome={goHome}
      />
      {view === "home" && (
        <OfficeView
          lite={lite}
          reducedMotion={reducedMotion}
          player={
            <PersonFigure
              config={person}
              shadows={!lite}
              motion={motionFor("idle", { reducedMotion, lite })}
            />
          }
          agent={bear}
          onUseDesk={props.onUseDesk}
          onGoOutside={goOutside}
        />
      )}
    </>
  );
}
