// The avatar lives in localStorage for now. Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded and memory is the fallback; a stored value that
// no longer parses is ignored and the default avatar is shown instead.

import { type AvatarConfig, defaultAvatar, parseAvatar } from "./avatar-config";

export const avatarKey = "bernlife.avatar";

type AvatarStorage = Pick<Storage, "getItem" | "setItem">;

export type AvatarStore = {
  get(): AvatarConfig;
  set(next: AvatarConfig): void;
  subscribe(listener: () => void): () => void;
};

function readAvatar(raw: string | null): AvatarConfig {
  if (raw === null) return defaultAvatar;
  try {
    return parseAvatar(JSON.parse(raw)) ?? defaultAvatar;
  } catch {
    return defaultAvatar;
  }
}

export function createAvatarStore(storage: () => AvatarStorage): AvatarStore {
  let current: AvatarConfig;
  try {
    current = readAvatar(storage().getItem(avatarKey));
  } catch {
    current = defaultAvatar;
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
