"use client";

import { useSyncExternalStore } from "react";
import { type BearConfig, defaultBear } from "./bear-config";
import { type AvatarStore, createAvatarStore } from "./avatar-store";

let store: AvatarStore | undefined;

function browserStore(): AvatarStore {
  store ??= createAvatarStore(() => window.localStorage);
  return store;
}

export function useAvatar(): [BearConfig, (next: BearConfig) => void] {
  const avatar = useSyncExternalStore(
    (listener) => browserStore().subscribe(listener),
    () => browserStore().get(),
    () => defaultBear,
  );
  return [avatar, (next) => browserStore().set(next)];
}
