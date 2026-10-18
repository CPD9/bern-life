import type { AspectMatrix, Coverage } from "./aspect-matrix";

const coverageLabels: Record<Coverage, string> = {
  covered: "Covered",
  partial: "Partly",
  none: "Not covered",
};

const coverageStyles: Record<Coverage, string> = {
  covered: "bg-primary text-primary-ink",
  partial: "bg-warn-bg text-warn-ink",
  none: "border-panel-border text-muted border border-dashed",
};

function CoverageBadge({ coverage }: { coverage: Coverage }) {
  return (
    <span
      className={`rounded-pill inline-block px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${coverageStyles[coverage]}`}
    >
      {coverageLabels[coverage]}
    </span>
  );
}

export function BriefNeeds({ matrix }: { matrix: AspectMatrix }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-extrabold">What your brief needs</h3>
      <ol className="flex flex-col gap-2">
        {matrix.needs.map((need) => (
          <li key={need.term} className="bg-chip rounded-2xl p-3 text-sm">
            <p className="font-bold">{need.term}</p>
            <p className="text-muted">From your brief: “{need.span}”</p>
          </li>
        ))}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="text-muted pb-2 text-left">
            How the results cover each need, judged from the claims each result cites.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-3">
                Result
              </th>
              {matrix.needs.map((need) => (
                <th key={need.term} scope="col" className="py-1 pr-3">
                  {need.term}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.rank} className="border-panel-border border-t">
                <th scope="row" className="py-2 pr-3 font-bold">
                  {row.rank}. {row.name}
                </th>
                {row.cells.map((coverage, index) => (
                  <td key={matrix.needs[index]?.term} className="py-2 pr-3">
                    <CoverageBadge coverage={coverage} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matrix.gaps.length === 0 ? (
        <p className="text-sm">Every need is covered by at least one result.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {matrix.gaps.map(({ need, best }) => (
            <li key={need.term}>
              <strong>Gap:</strong> no result fully covers “{need.term}”
              {best === "partial" ? "; at least one covers it partly." : "."}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
