"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionsApi, ConnectionsFailure, Member, Outcome } from "./connections-api";
import type { Answer } from "./input";
import { gainedConnection } from "./network";
import type { ConnectionView } from "./types";

export type ConnectionsController = {
  status: "loading" | "ready" | "failed";
  /** False when the server says nobody is signed in: the directory shows, nothing else does. */
  signedIn: boolean;
  members: Member[];
  requests: ConnectionView[];
  failure: ConnectionsFailure | null;
  refresh(): Promise<void>;
  ask(handle: string, note: string): Promise<boolean>;
  answer(id: string, answer: Answer): Promise<boolean>;
};

type Lists = [Outcome<Member[]>, Outcome<ConnectionView[]>];

function read(api: ConnectionsApi): Promise<Lists> {
  return Promise.all([api.people(), api.requests()]);
}

type Options = {
  /** Reads again when this changes, as when a connection notification arrives. */
  refreshKey?: unknown;
  /** A connection was made: you accepted one, or one you asked for was accepted since. */
  onConnected?: () => void;
};

// One controller for the app: the desk's and the phone's Connections, and You's People tab, read
// the same lists. It reads when it mounts and whenever `refreshKey` changes; nothing polls.
export function useConnections(
  api: ConnectionsApi,
  { refreshKey, onConnected }: Options = {},
): ConnectionsController {
  const [status, setStatus] = useState<ConnectionsController["status"]>("loading");
  const [signedIn, setSignedIn] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<ConnectionView[]>([]);
  const [failure, setFailure] = useState<ConnectionsFailure | null>(null);
  const known = useRef<ConnectionView[] | null>(null);
  const connected = useRef(onConnected);
  useEffect(() => {
    connected.current = onConnected;
  }, [onConnected]);

  const apply = useCallback(([people, mine]: Lists) => {
    if (!people.ok) {
      setStatus("failed");
      setFailure(people.failure);
      return;
    }
    setMembers(people.value);
    const next = mine.ok ? mine.value : [];
    if (known.current !== null && gainedConnection(known.current, next)) connected.current?.();
    known.current = mine.ok ? next : null;
    setSignedIn(mine.ok);
    setRequests(next);
    setFailure(mine.ok || mine.failure === "unauthenticated" ? null : mine.failure);
    setStatus("ready");
  }, []);

  const refresh = useCallback(async () => apply(await read(api)), [api, apply]);

  useEffect(() => {
    void read(api).then(apply);
  }, [api, apply, refreshKey]);

  return {
    status,
    signedIn,
    members,
    requests,
    failure,
    refresh,
    async ask(handle, note) {
      const sent = await api.ask(handle, note);
      await refresh();
      setFailure(sent.ok ? null : sent.failure);
      return sent.ok;
    },
    async answer(id, answer) {
      const done = await api.answer(id, answer);
      await refresh();
      setFailure(done.ok ? null : done.failure);
      return done.ok;
    },
  };
}
