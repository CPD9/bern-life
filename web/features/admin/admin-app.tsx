"use client";

import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/infrastructure/ui/button";
import { type AdminApi, httpAdminApi } from "./admin-api";
import { AdminTabs } from "./admin-tabs";
import { REFUSAL_TEXT } from "./admin-text";
import { DataTab } from "./data-tab";
import { OperationsTab } from "./operations-tab";
import { type Loaded, useAdmin } from "./use-admin";

export type AdminAppProps = {
  /** The engine serves invented fixtures (DEMO_FIXTURES); the figures are labelled as such. */
  fixtureMode: boolean;
  /** Pass a stable object; a new one asks again. */
  api?: AdminApi;
};

type TabId = "operations" | "data";

// The desk's Admin app, in the dock only for an account with the admin role: Operations (the
// engine and its model calls) and Data (sources and names to check). The admin routes decide who
// may read; a refusal is said in one sentence, and Try again asks everything once more.
export function AdminApp({ fixtureMode, api = httpAdminApi }: AdminAppProps) {
  const { state, retry } = useAdmin(api);
  const [tab, setTab] = useState<TabId>("operations");
  const status = useRef<HTMLDivElement>(null);
  const health = state.health.status === "ok" ? state.health.value : null;
  const sources = state.sources.status === "ok" ? state.sources.value : null;

  function panel<T>(loaded: Loaded<T>, render: (value: T) => ReactNode) {
    if (loaded.status === "loading") return <p>Loading the figures.</p>;
    if (loaded.status === "ok") return render(loaded.value);
    return (
      <div className="flex flex-col items-start gap-3">
        <p>{REFUSAL_TEXT[loaded.status]}</p>
        {loaded.status === "error" && (
          <Button
            variant="primary"
            onClick={() => {
              status.current?.focus();
              retry();
            }}
          >
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p>How the engine is doing and what it holds. For admins only.</p>
      {fixtureMode && (
        <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
          <span className="font-extrabold">Sample data.</span> Invented figures for the demo.
        </p>
      )}
      {/* Try again unmounts its own button, so focus moves here instead of falling to the page. */}
      <div ref={status} tabIndex={-1} aria-live="polite" className="sr-only">
        {state.activity.status === "loading" ? "Loading the figures." : "Figures loaded."}
      </div>
      <AdminTabs
        label="Admin"
        selected={tab}
        onSelect={setTab}
        tabs={[
          {
            id: "operations",
            label: "Operations",
            panel: panel(state.activity, (activity) => (
              <OperationsTab health={health} activity={activity} />
            )),
          },
          {
            id: "data",
            label: "Data",
            panel: panel(state.flagged, (flagged) => (
              <DataTab sources={sources} flagged={flagged} />
            )),
          },
        ]}
      />
    </div>
  );
}
