import { useEffect, useState } from "react";
import { bernHour, lightingAt } from "../sky";

const SUN_DISTANCE = 160;
/** Half the shadow camera's width: covers the map from Liebefeld to the Bärengraben. */
const SHADOW_REACH = 190;
const MINUTE_MS = 60_000;

function useBernHour(): number {
  const [hour, setHour] = useState(() => bernHour(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setHour(bernHour(new Date())), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);
  return hour;
}

export function Lights({ night, shadows }: { night: boolean; shadows: boolean }) {
  const light = lightingAt(useBernHour(), night);
  const [x, y, z] = light.sunDirection;

  return (
    <group>
      <hemisphereLight
        color={light.skyColour}
        groundColor={light.groundColour}
        intensity={light.ambientIntensity}
      />
      <directionalLight
        position={[x * SUN_DISTANCE, y * SUN_DISTANCE, z * SUN_DISTANCE]}
        color={light.sunColour}
        intensity={light.sunIntensity}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_REACH}
        shadow-camera-right={SHADOW_REACH}
        shadow-camera-top={SHADOW_REACH}
        shadow-camera-bottom={-SHADOW_REACH}
        shadow-camera-far={SUN_DISTANCE * 3}
        shadow-bias={-0.0005}
      />
    </group>
  );
}
