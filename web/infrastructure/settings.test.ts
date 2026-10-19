import { describe, expect, test } from "bun:test";
import {
  applySettings,
  createSettingsStore,
  defaultSettings,
  parseSettings,
  settingsBootScript,
  settingsKey,
} from "./settings";

function freshRoot(): HTMLElement {
  return document.createElement("html");
}

function attributes(root: HTMLElement) {
  return ["data-theme", "data-graphics"].map((name) => root.getAttribute(name));
}

describe("parseSettings", () => {
  test("reads valid settings", () => {
    expect(
      parseSettings('{"night":"on","lite":true,"wallpaper":"aare","screensaver":false}'),
    ).toEqual({ night: "on", lite: true, wallpaper: "aare", screensaver: false });
  });

  test("settings saved before the desktop had a wallpaper get the Bern scene and the screensaver", () => {
    expect(parseSettings('{"night":"off","lite":true}')).toEqual({
      night: "off",
      lite: true,
      wallpaper: "bern",
      screensaver: true,
    });
  });

  test("an old stored dataSaver is accepted and dropped", () => {
    expect(parseSettings('{"night":"off","lite":true,"dataSaver":true}')).toEqual({
      night: "off",
      lite: true,
      wallpaper: "bern",
      screensaver: true,
    });
  });

  test("broken JSON, wrong types and missing fields fall back field by field", () => {
    expect(parseSettings("{not json")).toEqual(defaultSettings);
    expect(parseSettings(null)).toEqual(defaultSettings);
    expect(
      parseSettings('{"night":"dusk","lite":"yes","wallpaper":"moon","screensaver":"no"}'),
    ).toEqual({ night: "auto", lite: false, wallpaper: "bern", screensaver: true });
    expect(parseSettings('{"wallpaper":"night","screensaver":false}')).toEqual({
      night: "auto",
      lite: false,
      wallpaper: "night",
      screensaver: false,
    });
  });
});

describe("applySettings", () => {
  test("writes theme and graphics attributes, and removes them when off or auto", () => {
    const root = freshRoot();
    applySettings(root, { ...defaultSettings, night: "on", lite: true });
    expect(attributes(root)).toEqual(["night", "lite"]);
    applySettings(root, { ...defaultSettings, night: "off", lite: false });
    expect(attributes(root)).toEqual(["day", null]);
    applySettings(root, defaultSettings);
    expect(attributes(root)).toEqual([null, null]);
  });
});

describe("createSettingsStore", () => {
  test("loads, saves and notifies through working storage", () => {
    const saved = new Map([[settingsKey, '{"night":"on"}']]);
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    const root = freshRoot();
    const store = createSettingsStore(() => storage, root);
    let notified = 0;
    store.subscribe(() => notified++);
    expect(store.get()).toEqual({
      night: "on",
      lite: false,
      wallpaper: "bern",
      screensaver: true,
    });
    store.set({ night: "on", lite: true, wallpaper: "night", screensaver: false });
    expect(saved.get(settingsKey)).toBe(
      '{"night":"on","lite":true,"wallpaper":"night","screensaver":false}',
    );
    expect(root.getAttribute("data-graphics")).toBe("lite");
    expect(notified).toBe(1);
  });

  test("blocked storage falls back to defaults and keeps changes in memory", () => {
    const blocked = () => {
      throw new DOMException("denied", "SecurityError");
    };
    const store = createSettingsStore(blocked, freshRoot());
    expect(store.get()).toEqual(defaultSettings);
    store.set({ ...defaultSettings, night: "on" });
    expect(store.get().night).toBe("on");
  });
});

describe("settingsBootScript", () => {
  test("applies stored settings to the document before any bundle runs", () => {
    localStorage.setItem(
      settingsKey,
      '{"night":"on","lite":true,"dataSaver":true,"wallpaper":"night"}',
    );
    const root = document.documentElement;
    try {
      new Function(settingsBootScript)();
      expect(attributes(root)).toEqual(["night", "lite"]);
      expect(root.getAttribute("data-saver")).toBeNull();
      // The wallpaper is the desktop's alone; nothing on <html> needs it before first paint.
      expect(root.getAttribute("data-wallpaper")).toBeNull();
    } finally {
      localStorage.removeItem(settingsKey);
      applySettings(root, defaultSettings);
    }
  });
});
