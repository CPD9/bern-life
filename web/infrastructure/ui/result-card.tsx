"use client";

import { useId, useState } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { Profile } from "@/infrastructure/contract-types.generated";
import { ClaimButton, EvidencePanel, SpanEvidence } from "./claim-evidence";
import { ResultMetricsRow } from "./result-metrics-row";
import {
  type ClaimRef,
  type SearchResult,
  type Via,
  citedClaims,
  citesOnlyName,
  fieldLabels,
  presentFields,
  relatedKind,
  viaClaims,
} from "@/infrastructure/claims";

const kindLabels: Record<Profile["kind"], string> = {
  person: "Person",
  unit: "Unit",
  project: "Project",
  infrastructure: "Infrastructure",
  call: "Funding call",
  service: "Service",
  space: "Space",
};

const relationText: Record<Via["kind"], string> = {
  leads: "Leads",
  works_on: "Works on",
  member_of: "Member of",
};

/**
 * "Through the project PlateScan". The kind is read from the related id; an id whose prefix is not
 * a kind the card knows is named without one, rather than guessed.
 */
function throughHeading(via: Via): string {
  const kind = relatedKind(via);
  return via.related_profile_id.startsWith(`${kind}-`)
    ? `Through the ${kind} ${via.related_name}`
    : `Through ${via.related_name}`;
}

// A claim can appear twice (in its field and under "Why it matches"); the open evidence panel
// belongs to the group that was clicked, so its key is group plus pointer.
type OpenClaim = { group: string; pointer: string } | null;

type ResultCardProps = { result: SearchResult; events?: AppEventSink };

export function ResultCard({ result, events = appEvents }: ResultCardProps) {
  const [open, setOpen] = useState<OpenClaim>(null);
  function toggle(next: OpenClaim) {
    setOpen(next);
    if (next !== null) events.emit("evidence_opened");
  }
  const baseId = useId();
  const cited = new Set(result.reason.cites);
  const { profile, via } = result;
  const nameOpen = open?.group === "name";
  // A reason that cites only the name adds nothing when the relation explains the result; without
  // a relation it is the only explanation the card has, so it stays.
  const whyShown = !via || !citesOnlyName(result);

  function claimGroup(
    group: string,
    refs: ClaimRef[],
    isCited = (pointer: string) => cited.has(pointer),
  ) {
    const openRef = open?.group === group ? refs.find((ref) => ref.pointer === open.pointer) : null;
    // Section headings are `${baseId}-why` and `${baseId}-via`, so panels get their own suffix.
    const panelId = `${baseId}-${group}-evidence`;
    return (
      <>
        <span className="flex flex-wrap gap-1.5">
          {refs.map(({ pointer, claim }) => (
            <ClaimButton
              key={pointer}
              claim={claim}
              cited={isCited(pointer)}
              open={openRef?.pointer === pointer}
              panelId={panelId}
              onToggle={() => toggle(openRef?.pointer === pointer ? null : { group, pointer })}
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
              onClick={() => toggle(nameOpen ? null : { group: "name", pointer: "/name" })}
              className="text-left text-lg font-extrabold underline decoration-dotted underline-offset-4"
            >
              {profile.name.value}
            </button>
          </h3>
        </div>
      </header>
      {nameOpen && <EvidencePanel claim={profile.name} id={`${baseId}-name-evidence`} />}
      <ResultMetricsRow metrics={result.metrics} />

      <dl className="flex flex-col gap-3">
        {presentFields(profile).map(({ field, claims }) => (
          <div key={field} className="flex flex-col gap-1">
            <dt className="text-muted text-sm font-bold">{fieldLabels[field]}</dt>
            <dd>{claimGroup(field, claims)}</dd>
          </div>
        ))}
      </dl>

      {via && (
        <section aria-labelledby={`${baseId}-via`} className="flex flex-col gap-2">
          <h4 id={`${baseId}-via`} className="font-extrabold">
            {throughHeading(via)}
          </h4>
          <SpanEvidence
            evidence={via}
            note={`${relationText[via.kind]} ${via.related_name} according to this sentence.`}
          />
          <p className="text-muted text-sm">{via.related_name} matches on:</p>
          {claimGroup("via", viaClaims(via), () => true)}
        </section>
      )}

      {whyShown && (
        <section aria-labelledby={`${baseId}-why`} className="flex flex-col gap-2">
          <h4 id={`${baseId}-why`} className="font-extrabold">
            Why it matches
          </h4>
          <p>{result.reason.text}</p>
          <p className="text-muted text-sm">Based on these claims:</p>
          {claimGroup("why", citedClaims(result))}
        </section>
      )}

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
