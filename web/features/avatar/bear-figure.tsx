// A little Bern bear, or a friend from the same family, from three.js primitives only: a big
// round head on a small round body, feet on y = 0, facing +z. Used by the editor's turntable and,
// later, the home room, the office and the map.

import { type BearConfig } from "./bear-config";
import { BearAccessory } from "./bear-accessory";
import { BearBody } from "./bear-body";
import { BearHead } from "./bear-head";
import { bearLook } from "./bear-look";
import { BearOutfit, OUTFITS } from "./bear-outfit";
import { PlushQualityProvider, plushQuality } from "./plush";

export function BearFigure({ config, lite }: { config: BearConfig; lite: boolean }) {
  const look = bearLook(config);
  return (
    <PlushQualityProvider value={plushQuality(lite)}>
      <group>
        <BearBody kind={config.kind} look={look} sleeves={OUTFITS[config.outfit].sleeves} />
        <BearOutfit outfit={config.outfit} />
        <BearHead config={config} look={look} />
        <BearAccessory accessory={config.accessory} />
      </group>
    </PlushQualityProvider>
  );
}
