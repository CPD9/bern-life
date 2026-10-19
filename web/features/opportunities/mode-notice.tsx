// In fixture mode a "mock" answer is canned test data and earns the MOCK banner; from the engine it
// is stored pages searched without a model, which a quieter line says.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

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
        No model answered. These results are canned test data.
      </p>
    );
  }
  const line =
    mode === "mock"
      ? "Plain search: your words only. Apertus adds search terms for the recorded questions, or in a live run."
      : mode === "replay"
        ? "Replay · answered from recorded model calls"
        : null;
  if (line === null) return null;
  return (
    <span className="bg-chip text-muted rounded-pill self-start px-3 py-1 text-xs font-bold">
      {line}
    </span>
  );
}
