"use client";

import { useSyncExternalStore } from "react";
import { defaultAgentName, parseAgentName } from "./agent-name";
import { type LocalValue, createLocalValue } from "./local-value";
import { type PersonConfig, defaultPerson, parsePerson } from "./person-config";

export const personKey = "bernlife.person";
export const agentNameKey = "bernlife.agent-name";

function useLocalValue<T>(value: () => LocalValue<T>, fallback: T): [T, (next: T) => void] {
  const current = useSyncExternalStore(
    (listener) => value().subscribe(listener),
    () => value().get(),
    () => fallback,
  );
  return [current, (next) => value().set(next)];
}

let person: LocalValue<PersonConfig> | undefined;
let agentName: LocalValue<string> | undefined;

const storage = () => window.localStorage;

export function usePerson(): [PersonConfig, (next: PersonConfig) => void] {
  return useLocalValue(() => {
    person ??= createLocalValue({
      storage,
      key: personKey,
      parse: parsePerson,
      fallback: defaultPerson,
    });
    return person;
  }, defaultPerson);
}

export function useAgentName(): [string, (next: string) => void] {
  return useLocalValue(() => {
    agentName ??= createLocalValue({
      storage,
      key: agentNameKey,
      parse: parseAgentName,
      fallback: defaultAgentName,
    });
    return agentName;
  }, defaultAgentName);
}
