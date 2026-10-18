// A little Bern bear, or a friend from the same family, from three.js primitives only: a big
// round head on a small round body, feet on y = 0, facing +z. It stands still, idles or walks, as
// the caller asks; the editor's turntable uses it now, the home room, office and map later.

import { type BearConfig } from "./bear-config";
import { BodyAccessory } from "./bear-accessory";
import { BearBody } from "./bear-body";
import { BearHead } from "./bear-head";
import { bearLook } from "./bear-look";
import { type Motion } from "./bear-motion";
import { BearOutfit, OUTFITS } from "./bear-outfit";
import { PlushQualityProvider, plushQuality } from "./plush";
import { useBearMotion } from "./use-bear-motion";

type BearFigureProps = { config: BearConfig; lite: boolean; motion: Motion };

export function BearFigure({ config, lite, motion }: BearFigureProps) {
  const look = bearLook(config);
  const root = useBearMotion(motion);
  return (
    <PlushQualityProvider value={plushQuality(lite)}>
      <group ref={root}>
        <BearBody kind={config.kind} look={look} sleeves={OUTFITS[config.outfit].sleeves} />
        <BearOutfit outfit={config.outfit} />
        <BearHead config={config} look={look} />
        <BodyAccessory accessory={config.accessory} />
      </group>
    </PlushQualityProvider>
  );
}
