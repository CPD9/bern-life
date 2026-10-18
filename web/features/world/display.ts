// The world reads the shell's settings from <html> instead of importing the shell: night mode is
// data-theme ("day" | "night", the OS decides when absent) and lite graphics is
// data-graphics="lite". Reduced motion comes from the OS.

import { useSyncExternalStore } from "react";

export type WorldDisplay = {
  readonly night: boolean;
  readonly lite: boolean;
  readonly reducedMotion: boolean;
};

export type DisplaySignals = {
  readonly theme: string | null;
  readonly graphics: string | null;
  readonly prefersDark: boolean;
  readonly prefersReducedMotion: boolean;
};

export function displayFrom(signals: DisplaySignals): WorldDisplay {
  return {
    night: signals.theme === "night" || (signals.theme !== "day" && signals.prefersDark),
    lite: signals.graphics === "lite",
    reducedMotion: signals.prefersReducedMotion,
  };
}

function subscribeToHtml(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-graphics"],
  });
  return () => observer.disconnect();
}

function mediaStore(query: string) {
  return {
    subscribe(onChange: () => void): () => void {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    read: () => window.matchMedia(query).matches,
  };
}

const darkScheme = mediaStore("(prefers-color-scheme: dark)");
const reducedMotion = mediaStore("(prefers-reduced-motion: reduce)");
const serverFalse = () => false;
const serverNull = () => null;

export function useWorldDisplay(): WorldDisplay {
  const theme = useSyncExternalStore(
    subscribeToHtml,
    () => document.documentElement.dataset.theme ?? null,
    serverNull,
  );
  const graphics = useSyncExternalStore(
    subscribeToHtml,
    () => document.documentElement.dataset.graphics ?? null,
    serverNull,
  );
  const prefersDark = useSyncExternalStore(darkScheme.subscribe, darkScheme.read, serverFalse);
  const prefersReducedMotion = useSyncExternalStore(
    reducedMotion.subscribe,
    reducedMotion.read,
    serverFalse,
  );
  return displayFrom({ theme, graphics, prefersDark, prefersReducedMotion });
}
