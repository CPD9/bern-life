import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export function FixtureLabel() {
  return (
    <span className="border-panel-border text-muted rounded-pill border px-3 py-1 text-xs font-bold tracking-wide">
      FIXTURE data
    </span>
  );
}

export function ModeNotice({ mode }: { mode: SearchResponse["mode"] }) {
  if (mode === "mock") {
    return (
      <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
        <strong className="mr-2 text-base tracking-widest">MOCK</strong>
        No model answered. These results and explanations are canned test data.
      </p>
    );
  }
  if (mode === "replay") {
    return (
      <span className="bg-chip text-muted rounded-pill self-start px-3 py-1 text-xs font-bold">
        Replay · answered from recorded model calls
      </span>
    );
  }
  return null;
}
