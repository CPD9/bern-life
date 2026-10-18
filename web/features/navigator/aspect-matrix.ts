// Which of the brief's needs each result covers, judged only from the claims the result cites
// in "why it matches". A need is covered when every content word of it appears in those claims,
// partly covered when some do. Words match as substrings, so "sensor" finds "biosensors".
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { contentWords, foldText } from "@/infrastructure/text-match";
import { citedClaims } from "@/infrastructure/claims";

export type BriefNeed = NonNullable<SearchResponse["brief_terms"]>[number];

export type Coverage = "covered" | "partial" | "none";

export type AspectRow = {
  readonly rank: number;
  readonly name: string;
  readonly cells: Coverage[];
};

export type AspectMatrix = {
  readonly needs: BriefNeed[];
  readonly rows: AspectRow[];
  /** Needs that no result covers fully, with the best coverage any result reaches. */
  readonly gaps: { need: BriefNeed; best: Exclude<Coverage, "covered"> }[];
};

export function coverage(need: string, citedText: string): Coverage {
  const words = contentWords(need);
  const found = words.filter((word) => citedText.includes(word)).length;
  if (words.length > 0 && found === words.length) return "covered";
  return found > 0 ? "partial" : "none";
}

export function aspectMatrix(response: SearchResponse): AspectMatrix | null {
  const needs = response.brief_terms;
  if (!needs || needs.length === 0) return null;
  const rows = response.results.map((result) => {
    const citedText = foldText(
      citedClaims(result)
        .map(({ claim }) => `${claim.value} ${claim.evidence.span}`)
        .join(" "),
    );
    return {
      rank: result.rank,
      name: result.profile.name.value,
      cells: needs.map((need) => coverage(need.term, citedText)),
    };
  });
  const gaps = needs.flatMap((need, index) => {
    const cells = rows.map((row) => row.cells[index]);
    if (cells.includes("covered")) return [];
    return [{ need, best: cells.includes("partial") ? ("partial" as const) : ("none" as const) }];
  });
  return { needs, rows, gaps };
}
