"use client";

import { useEffect, useRef, useState } from "react";
import { Toggle } from "@/infrastructure/ui/toggle";
import type { Fetch } from "./profile-api";

// Whether messages and connection requests reach you in the app, kept with your account
// (PUT /api/notifications/preferences). Signed out there is nothing to choose; your agent's loop
// news always shows, since it never leaves this browser.

export type InAppLoad = boolean | "signed-out" | "failed";

export interface InAppApi {
  load(): Promise<InAppLoad>;
  save(on: boolean): Promise<boolean>;
}

const PATH = "/api/notifications/preferences";

export function inAppApiOver(send: Fetch): InAppApi {
  return {
    load: async () => {
      try {
        const response = await send(PATH, { method: "GET" });
        if (response.status === 401) return "signed-out";
        if (!response.ok) return "failed";
        return ((await response.json()) as { inApp: boolean }).inApp === true;
      } catch {
        return "failed";
      }
    },
    save: async (on) => {
      try {
        const response = await send(PATH, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inApp: on }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

export const httpInAppApi: InAppApi = inAppApiOver((path, init) => fetch(path, init));

const descriptions: Record<"signed-out" | "failed" | "loading", string> = {
  loading: "Checking your account.",
  "signed-out": "Messages and requests need an account. Your agent's loop news always shows.",
  failed: "This choice could not be loaded. Your agent's loop news always shows.",
};

export function InAppSetting({ api }: { api: InAppApi }) {
  const [state, setState] = useState<InAppLoad | "loading">("loading");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let current = true;
    void api.load().then((loaded) => {
      if (current) setState(loaded);
    });
    return () => {
      current = false;
    };
  }, [api]);

  async function change(on: boolean) {
    if (saving.current) return;
    saving.current = true;
    const saved = await api.save(on);
    saving.current = false;
    if (saved) setState(on);
    setNotice(saved ? "Saved." : "Not saved. Try again in a moment.");
  }

  const choosing = typeof state === "boolean";
  return (
    <div className="flex flex-col gap-1">
      <Toggle
        label="In the app"
        description={
          choosing
            ? "Messages and connection requests, shown here while you use Bern Life."
            : descriptions[state]
        }
        checked={choosing ? state : true}
        disabled={!choosing}
        onChange={(on) => void change(on)}
      />
      <p aria-live="polite" className="text-muted min-h-5 text-sm">
        {notice}
      </p>
    </div>
  );
}
