"use client";

import { shownAgentName } from "@/features/avatar/agent-name";
import type { BearConfig } from "@/features/avatar/bear-config";
import { BearFigure } from "@/features/avatar/bear-figure";
import type { PersonConfig } from "@/features/avatar/person-config";
import { PersonFigure } from "@/features/avatar/person-figure";
import { OfficeView } from "@/features/office/office-view";
import type { WorldView } from "@/features/shell/game-shell";
import type { Building } from "@/features/world/buildings";
import { WorldCanvas } from "@/features/world/world-canvas";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

type WorldSceneProps = {
  view: WorldView;
  demoSearch: SearchResponse | undefined;
  person: PersonConfig;
  bear: BearConfig;
  agentName: string;
  lite: boolean;
  reducedMotion: boolean;
  onAgentOpen: () => void;
  onSearchHere: (building: Building) => void;
  onPlacePanel: (open: boolean) => void;
  onUseDesk: () => void;
  onGoOutside: () => void;
};

// The map always, with the office over it on Home: the player is a person, the agent a bear.
export function WorldScene({ view, person, bear, agentName, lite, ...props }: WorldSceneProps) {
  return (
    <>
      <WorldCanvas
        demoSearch={props.demoSearch}
        agent={{
          name: shownAgentName(agentName),
          figure: (liteFigure) => <BearFigure config={bear} lite={liteFigure} motion="still" />,
        }}
        onAgentOpen={props.onAgentOpen}
        onSearchHere={props.onSearchHere}
        onPlacePanel={props.onPlacePanel}
      />
      {view === "home" && (
        <OfficeView
          lite={lite}
          reducedMotion={props.reducedMotion}
          player={<PersonFigure config={person} shadows={!lite} />}
          agent={bear}
          onUseDesk={props.onUseDesk}
          onGoOutside={props.onGoOutside}
        />
      )}
    </>
  );
}
