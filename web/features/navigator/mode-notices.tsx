// "mock" means two things: in fixture mode the answer is canned test data, while from the engine
// it is real stored pages searched without a model (on the replay path, no call was recorded for
// this question). Only the first earns the yellow MOCK banner.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export function FixtureLabel() {
  return (
    <span className="border-panel-border text-muted rounded-pill border px-3 py-1 text-xs font-bold tracking-wide">
      FIXTURE data
    </span>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="bg-chip text-muted rounded-pill self-start px-3 py-1 text-xs font-bold">
      {children}
    </span>
  );
}

export function ModeNotice({
  mode,
  fixtureMode,
}: {
  mode: SearchResponse["mode"];
  fixtureMode: boolean;
}) {
  if (mode === "mock" && fixtureMode) {
    return (
      <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
        <strong className="mr-2 text-base tracking-widest">MOCK</strong>
        No model answered. These results and explanations are canned test data.
      </p>
    );
  }
  if (mode === "mock") {
    return (
      <Chip>
        Plain search: your words only. Apertus adds search terms for the recorded questions, or in a
        live run.
      </Chip>
    );
  }
  if (mode === "replay") return <Chip>Replay · answered from recorded model calls</Chip>;
  return null;
}
