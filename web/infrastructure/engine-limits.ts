// How much of the engine one address, and one signed-in person, may use per window of the shared
// limiter (features/accounts/rate-limit.ts, 15 minutes). Over the address limit a request is
// refused; over the personal live limit it is still answered, from the recorded calls only. A
// refused request counts too, so a flood stays refused until its window closes.
import type { EngineRoute } from "./engine-guard";

type EngineLimit = { readonly perIp: number; readonly livePerUser: number };

export const ENGINE_LIMITS: Readonly<Record<EngineRoute, EngineLimit>> = {
  search: { perIp: 60, livePerUser: 20 },
  brief: { perIp: 10, livePerUser: 5 },
  agent: { perIp: 20, livePerUser: 10 },
};
