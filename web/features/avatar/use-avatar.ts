"use client";

import { useSyncExternalStore } from "react";
import { type AvatarConfig, defaultAvatar } from "./avatar-config";
import { type AvatarStore, createAvatarStore } from "./avatar-store";

let store: AvatarStore | undefined;

function browserStore(): AvatarStore {
  store ??= createAvatarStore(() => window.localStorage);
  return store;
}

export function useAvatar(): [AvatarConfig, (next: AvatarConfig) => void] {
  const avatar = useSyncExternalStore(
    (listener) => browserStore().subscribe(listener),
    () => browserStore().get(),
    () => defaultAvatar,
  );
  return [avatar, (next) => browserStore().set(next)];
}
