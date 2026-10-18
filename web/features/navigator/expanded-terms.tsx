import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export function ExpandedTerms({ terms }: { terms: SearchResponse["expanded_terms"] }) {
  if (terms.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold">Also searched for</h3>
      <p className="text-muted text-sm">
        Search terms the Navigator added to widen the search. They are not facts about anyone.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <li
            key={`${term.kind}-${term.term}`}
            className="bg-chip rounded-pill flex items-baseline gap-1.5 px-3 py-1 text-sm"
          >
            {term.term}
            <span className="text-muted text-xs">{term.kind}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
