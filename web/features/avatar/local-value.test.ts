import { describe, expect, test } from "bun:test";
import { defaultAgentName, parseAgentName, shownAgentName } from "./agent-name";
import { createLocalValue } from "./local-value";
import { defaultPerson, parsePerson } from "./person-config";
import { personKey } from "./use-person";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

const chosen = {
  body: "slim",
  skin: "tone-7",
  hair: "curly",
  outfit: "field-work",
  accent: "teal",
} as const;

const personIn = (storage: () => Pick<Storage, "getItem" | "setItem">) =>
  createLocalValue({ storage, key: personKey, parse: parsePerson, fallback: defaultPerson });

describe("createLocalValue", () => {
  test("a saved person is read back by the next visit, under its own key", () => {
    const storage = memoryStorage();
    personIn(() => storage).set(chosen);
    expect(storage.getItem("bernlife.person")).toBe(JSON.stringify(chosen));
    expect(personIn(() => storage).get()).toEqual(chosen);
  });

  test("a corrupted value, or a bear left from before, shows the default person", () => {
    const corrupted = memoryStorage({ [personKey]: "{not json" });
    expect(personIn(() => corrupted).get()).toEqual(defaultPerson);

    const bear = { kind: "brown-bear", fur: "honey", face: "happy", outfit: "casual" };
    const outdated = memoryStorage({ [personKey]: JSON.stringify(bear) });
    expect(personIn(() => outdated).get()).toEqual(defaultPerson);
  });

  test("blocked storage keeps the value in memory and still notifies", () => {
    const store = personIn(() => throwing);
    let notified = 0;
    store.subscribe(() => notified++);
    expect(store.get()).toEqual(defaultPerson);
    store.set(chosen);
    expect(store.get()).toEqual(chosen);
    expect(notified).toBe(1);
  });
});

describe("agent name", () => {
  test("it starts as Bärli, and a blank name still reads as Bärli", () => {
    expect(defaultAgentName).toBe("Bärli");
    expect(shownAgentName("   ")).toBe("Bärli");
    expect(shownAgentName("  Bärli ")).toBe("Bärli");
  });

  test("a stored name is cut to 24 characters, and anything else is not a name", () => {
    expect(parseAgentName("A very long name for a small bear")).toBe("A very long name for a s");
    expect(parseAgentName(7)).toBeNull();
  });
});
