// The avatar lives in localStorage for now. Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded and memory is the fallback; a stored value that
// no longer parses is ignored and the default avatar is shown instead.

import { type BearConfig, defaultBear, parseBear } from "./bear-config";

export const avatarKey = "bernlife.avatar";

type AvatarStorage = Pick<Storage, "getItem" | "setItem">;

export type AvatarStore = {
  get(): BearConfig;
  set(next: BearConfig): void;
  subscribe(listener: () => void): () => void;
};

function readAvatar(raw: string | null): BearConfig {
  if (raw === null) return defaultBear;
  try {
    return parseBear(JSON.parse(raw)) ?? defaultBear;
  } catch {
    return defaultBear;
  }
}

export function createAvatarStore(storage: () => AvatarStorage): AvatarStore {
  let current: BearConfig;
  try {
    current = readAvatar(storage().getItem(avatarKey));
  } catch {
    current = defaultBear;
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      try {
        storage().setItem(avatarKey, JSON.stringify(next));
      } catch {
        // Kept in memory for this visit only.
      }
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
