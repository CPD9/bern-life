"use client";

import { useEffect, useRef, useState } from "react";
import { type Choice, ChoiceRow } from "./choice-row";
import type { Fetch, ProfileVisibility } from "./profile-api";

// Who may visit your office, kept with your account. The office route saves the plot, the layout
// and this choice together, so a change sends the stored plot and layout back unchanged; your own
// office is always readable to you at /api/people/<handle>/office.

type Office = { plot: unknown; layout: unknown; visitVisibility: ProfileVisibility };
export type VisitLoad =
  | { status: "ready"; handle: string; office: Office }
  | { status: "signed-out" }
  | { status: "failed" };

export interface VisitApi {
  load(): Promise<VisitLoad>;
  save(office: Office): Promise<boolean>;
}

export function visitApiOver(send: Fetch): VisitApi {
  return {
    load: async () => {
      try {
        const me = await send("/api/auth/me", { method: "GET" });
        if (me.status === 401) return { status: "signed-out" };
        if (!me.ok) return { status: "failed" };
        const { handle } = ((await me.json()) as { user: { handle: string } }).user;
        const response = await send(`/api/people/${encodeURIComponent(handle)}/office`, {
          method: "GET",
        });
        if (response.status === 404) {
          const office: Office = { plot: null, layout: null, visitVisibility: "private" };
          return { status: "ready", handle, office };
        }
        if (!response.ok) return { status: "failed" };
        const { office } = (await response.json()) as { office: Office };
        return { status: "ready", handle, office };
      } catch {
        return { status: "failed" };
      }
    },
    save: async (office) => {
      try {
        const response = await send("/api/auth/me/office", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(office),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

export const httpVisitApi: VisitApi = visitApiOver((path, init) => fetch(path, init));

const choices: readonly Choice<ProfileVisibility>[] = [
  { value: "private", label: "Only me" },
  { value: "members", label: "Members" },
];

/** Signed out, or while the account cannot be read, there is nothing to choose and nothing shows. */
export function VisitSetting({ api }: { api: VisitApi }) {
  const [load, setLoad] = useState<VisitLoad | null>(null);
  const [notice, setNotice] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let current = true;
    void api.load().then((loaded) => {
      if (current) setLoad(loaded);
    });
    return () => {
      current = false;
    };
  }, [api]);

  if (load === null || load.status !== "ready") return null;
  const { office } = load;

  async function change(visitVisibility: ProfileVisibility) {
    if (saving.current || load === null || load.status !== "ready") return;
    saving.current = true;
    const next = { ...office, visitVisibility };
    const saved = await api.save(next);
    saving.current = false;
    if (saved) setLoad({ ...load, office: next });
    setNotice(saved ? "Saved." : "Not saved. Try again in a moment.");
  }

  const visible = office.visitVisibility === "public" ? "members" : office.visitVisibility;
  return (
    <div className="flex flex-col gap-1">
      <ChoiceRow
        title="Who may visit your office"
        description="Members can look around your office from Connections. Nothing in it can be changed by a visitor."
        choices={choices}
        value={visible}
        onChange={(next) => void change(next)}
      />
      <p aria-live="polite" className="text-muted min-h-5 text-sm">
        {notice}
      </p>
    </div>
  );
}
