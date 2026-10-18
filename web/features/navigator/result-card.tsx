"use client";

import { useId, useState } from "react";
import type { Profile } from "@/infrastructure/contract-types.generated";
import { ClaimButton, EvidencePanel } from "./claim-evidence";
import {
  type ClaimRef,
  type SearchResult,
  citedClaims,
  fieldLabels,
  presentFields,
} from "@/infrastructure/claims";

const kindLabels: Record<Profile["kind"], string> = {
  person: "Person",
  unit: "Unit",
  project: "Project",
  infrastructure: "Infrastructure",
};

// A claim can appear twice (in its field and under "Why it matches"); the open evidence panel
// belongs to the group that was clicked, so its key is group plus pointer.
type OpenClaim = { group: string; pointer: string } | null;

export function ResultCard({ result }: { result: SearchResult }) {
  const [open, setOpen] = useState<OpenClaim>(null);
  const baseId = useId();
  const cited = new Set(result.reason.cites);
  const { profile } = result;
  const nameOpen = open?.group === "name";

  function claimGroup(group: string, refs: ClaimRef[]) {
    const openRef = open?.group === group ? refs.find((ref) => ref.pointer === open.pointer) : null;
    const panelId = `${baseId}-${group}`;
    return (
      <>
        <span className="flex flex-wrap gap-1.5">
          {refs.map(({ pointer, claim }) => (
            <ClaimButton
              key={pointer}
              claim={claim}
              cited={cited.has(pointer)}
              open={openRef?.pointer === pointer}
              panelId={panelId}
              onToggle={() => setOpen(openRef?.pointer === pointer ? null : { group, pointer })}
            />
          ))}
        </span>
        {openRef && <EvidencePanel claim={openRef.claim} id={panelId} />}
      </>
    );
  }

  return (
    <article
      aria-labelledby={`${baseId}-name`}
      className="rounded-panel bg-panel border-panel-border shadow-panel flex flex-col gap-4 border p-5"
    >
      <header className="flex items-start gap-3">
        <span className="bg-chip-selected text-chip-selected-ink rounded-pill flex size-8 shrink-0 items-center justify-center text-sm font-extrabold">
          {result.rank}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            {kindLabels[profile.kind]}
          </p>
          <h3 id={`${baseId}-name`}>
            <button
              type="button"
              aria-expanded={nameOpen}
              aria-controls={`${baseId}-name-evidence`}
              onClick={() => setOpen(nameOpen ? null : { group: "name", pointer: "/name" })}
              className="text-left text-lg font-extrabold underline decoration-dotted underline-offset-4"
            >
              {profile.name.value}
            </button>
          </h3>
        </div>
      </header>
      {nameOpen && <EvidencePanel claim={profile.name} id={`${baseId}-name-evidence`} />}

      <dl className="flex flex-col gap-3">
        {presentFields(profile).map(({ field, claims }) => (
          <div key={field} className="flex flex-col gap-1">
            <dt className="text-muted text-sm font-bold">{fieldLabels[field]}</dt>
            <dd>{claimGroup(field, claims)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby={`${baseId}-why`} className="flex flex-col gap-2">
        <h4 id={`${baseId}-why`} className="font-extrabold">
          Why it matches
        </h4>
        <p>{result.reason.text}</p>
        <p className="text-muted text-sm">Based on these claims:</p>
        {claimGroup("why", citedClaims(result))}
      </section>

      <a
        href={profile.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary self-start font-bold underline"
      >
        Source page
      </a>
    </article>
  );
}
