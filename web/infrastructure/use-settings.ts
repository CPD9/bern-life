"use client";

import { useSyncExternalStore } from "react";
import {
  type Settings,
  type SettingsStore,
  createSettingsStore,
  defaultSettings,
} from "./settings";

let store: SettingsStore | undefined;

function browserStore(): SettingsStore {
  store ??= createSettingsStore(() => window.localStorage, document.documentElement);
  return store;
}

export function useSettings(): [Settings, (next: Settings) => void] {
  const settings = useSyncExternalStore(
    (listener) => browserStore().subscribe(listener),
    () => browserStore().get(),
    () => defaultSettings,
  );
  return [settings, (next) => browserStore().set(next)];
}
