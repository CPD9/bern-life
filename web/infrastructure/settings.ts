// Player settings live in localStorage and are mirrored as attributes on <html>, where CSS (night
// tokens) and the 3D world (`data-graphics="lite"`) read them. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and memory is the fallback.

export type NightMode = "off" | "on" | "auto";

export type Wallpaper = "bern" | "aare" | "night" | "plain";

export type Settings = {
  readonly night: NightMode;
  readonly lite: boolean;
  /** The scene behind the office computer's windows. */
  readonly wallpaper: Wallpaper;
  /** The office computer shows the scene and the time after 90 seconds without activity. */
  readonly screensaver: boolean;
};

export const defaultSettings: Settings = {
  night: "auto",
  lite: false,
  wallpaper: "bern",
  screensaver: true,
};

export const settingsKey = "bernlife.settings";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

const nightModes: readonly NightMode[] = ["off", "on", "auto"];

const wallpapers: readonly Wallpaper[] = ["bern", "aare", "night", "plain"];

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseSettings(raw: string | null): Settings {
  let value: unknown = null;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    return defaultSettings;
  }
  // Fields this version no longer has (an old `dataSaver`) are dropped, not refused.
  const { night, lite, wallpaper, screensaver } = (
    typeof value === "object" && value !== null ? value : {}
  ) as Record<string, unknown>;
  return {
    night: nightModes.find((mode) => mode === night) ?? defaultSettings.night,
    lite: flag(lite, defaultSettings.lite),
    wallpaper: wallpapers.find((scene) => scene === wallpaper) ?? defaultSettings.wallpaper,
    screensaver: flag(screensaver, defaultSettings.screensaver),
  };
}

function setFlag(root: HTMLElement, name: string, value: string | null) {
  if (value === null) root.removeAttribute(name);
  else root.setAttribute(name, value);
}

export function applySettings(root: HTMLElement, settings: Settings) {
  setFlag(
    root,
    "data-theme",
    settings.night === "auto" ? null : settings.night === "on" ? "night" : "day",
  );
  setFlag(root, "data-graphics", settings.lite ? "lite" : null);
}

// Runs inline in <head> before first paint, so a night-mode player never sees a day flash. It
// repeats applySettings in plain ES5 because it runs before any bundle loads.
export const settingsBootScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  settingsKey,
)})||"{}"),r=document.documentElement;if(s.night==="on")r.setAttribute("data-theme","night");if(s.night==="off")r.setAttribute("data-theme","day");if(s.lite===true)r.setAttribute("data-graphics","lite")}catch(e){}`;

export type SettingsStore = {
  get(): Settings;
  set(next: Settings): void;
  subscribe(listener: () => void): () => void;
};

export function createSettingsStore(
  storage: () => SettingsStorage,
  root: HTMLElement,
): SettingsStore {
  let current: Settings;
  try {
    current = parseSettings(storage().getItem(settingsKey));
  } catch {
    current = defaultSettings;
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      applySettings(root, next);
      try {
        storage().setItem(settingsKey, JSON.stringify(next));
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
