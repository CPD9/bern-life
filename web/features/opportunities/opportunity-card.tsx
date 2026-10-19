import type { ReactNode } from "react";
import type { AppEventSink } from "@/infrastructure/app-events";
import type { Claim } from "@/infrastructure/contract-types.generated";
import type { SearchResult } from "@/infrastructure/claims";
import { SpanEvidence } from "@/infrastructure/ui/claim-evidence";
import { ResultCard } from "@/infrastructure/ui/result-card";

// An amount or a deadline is shown only inside the sentence it was read from, never as a value of
// its own, so it cannot be read as formatted, converted or summed. The card gets a copy without
// those fields; their claims are quoted below it with their page.
const quotedFields = [
  { field: "deadline", label: "Deadline" },
  { field: "amount", label: "Amount" },
] as const;

type QuotedClaim = { label: string; claim: Claim };

export function quotedClaims(result: SearchResult): QuotedClaim[] {
  return quotedFields.flatMap(({ field, label }) =>
    (result.profile.fields[field] ?? []).map((claim) => ({ label, claim })),
  );
}

export function withoutQuotedFields(result: SearchResult): SearchResult {
  const fields = { ...result.profile.fields, deadline: [], amount: [] };
  return { ...result, profile: { ...result.profile, fields } };
}

type OpportunityCardProps = {
  result: SearchResult;
  renderSave?: ((result: SearchResult) => ReactNode) | undefined;
  events?: AppEventSink | undefined;
};

export function OpportunityCard({ result, renderSave, events }: OpportunityCardProps) {
  const quoted = quotedClaims(result);
  return (
    <div className="flex flex-col gap-2">
      <ResultCard result={withoutQuotedFields(result)} {...(events ? { events } : {})} />
      {quoted.length > 0 && (
        <section
          aria-label={`${result.profile.name.value}: as the page states it`}
          className="rounded-panel bg-panel border-panel-border flex flex-col gap-3 border p-5"
        >
          {quoted.map(({ label, claim }, index) => (
            <div key={`${label}-${index}`} className="flex flex-col">
              <h4 className="text-muted text-sm font-bold">{label}</h4>
              <SpanEvidence
                evidence={claim.evidence}
                note="Quoted as written there, never converted or added up."
              />
            </div>
          ))}
        </section>
      )}
      {renderSave && <div className="self-start">{renderSave(result)}</div>}
    </div>
  );
}
