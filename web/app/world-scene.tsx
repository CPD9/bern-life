"use client";

import { useMemo } from "react";
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
  const { reducedMotion } = props;
  const home = useMemo((): MapPoint | null => (plot === null ? null : [plot.x, plot.z]), [plot]);
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
        onGoHome={props.onGoHome}
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
          onGoOutside={props.onGoOutside}
        />
      )}
    </>
  );
}
