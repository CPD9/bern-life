"use client";

import { type PersonConfig } from "./person-config";
import { PersonFigure } from "./person-figure";
import { Turntable } from "./turntable";

export function PersonTurntable({ config, lite }: { config: PersonConfig; lite: boolean }) {
  return (
    <Turntable label="Turn your look" lite={lite} focusY={0.68}>
      <PersonFigure config={config} shadows={!lite} />
    </Turntable>
  );
}
