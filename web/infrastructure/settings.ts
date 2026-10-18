// Player settings live in localStorage and are mirrored as attributes on <html>, where CSS (night
// tokens) and the 3D world (`data-graphics="lite"`) read them. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and memory is the fallback.

export type NightMode = "off" | "on" | "auto";

export type Settings = {
  readonly night: NightMode;
  readonly lite: boolean;
  readonly dataSaver: boolean;
};

export const defaultSettings: Settings = { night: "auto", lite: false, dataSaver: false };

export const settingsKey = "bernlife.settings";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

const nightModes: readonly NightMode[] = ["off", "on", "auto"];

export function parseSettings(raw: string | null): Settings {
  let value: unknown = null;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    return defaultSettings;
  }
  const { night, lite, dataSaver } = (
    typeof value === "object" && value !== null ? value : {}
  ) as Record<string, unknown>;
  return {
    night: nightModes.find((mode) => mode === night) ?? defaultSettings.night,
    lite: typeof lite === "boolean" ? lite : defaultSettings.lite,
    dataSaver: typeof dataSaver === "boolean" ? dataSaver : defaultSettings.dataSaver,
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
  setFlag(root, "data-saver", settings.dataSaver ? "on" : null);
}

// Runs inline in <head> before first paint, so a night-mode player never sees a day flash. It
// repeats applySettings in plain ES5 because it runs before any bundle loads.
export const settingsBootScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  settingsKey,
)})||"{}"),r=document.documentElement;if(s.night==="on")r.setAttribute("data-theme","night");if(s.night==="off")r.setAttribute("data-theme","day");if(s.lite===true)r.setAttribute("data-graphics","lite");if(s.dataSaver===true)r.setAttribute("data-saver","on")}catch(e){}`;

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
