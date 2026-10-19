// The office plots a player can settle on: a small fixed set, one in each district where the
// institutions on the map cluster, plus Liebefeld. A plot is only a point on the shared map frame
// (1 unit ≈ 20 m, the Zytglogge at the origin, +x east, -z north); it carries no price, rent or
// claim about the street, so all the facts shown beside it come from the places' own pages.

export type PlotId = "altstadt" | "laenggasse" | "insel" | "mattenhof" | "liebefeld";

export type Plot = {
  readonly id: PlotId;
  /** The map district the plot stands in. */
  readonly district: string;
  readonly x: number;
  readonly z: number;
};

/** Where the choice starts when nothing is stored yet: the Old Town, by the Zytglogge. */
export const FIRST_PLOT: Plot = { id: "altstadt", district: "Altstadt", x: 12, z: -4 };

export const PLOTS: readonly Plot[] = [
  FIRST_PLOT,
  { id: "laenggasse", district: "Länggasse", x: -50, z: -36 },
  { id: "insel", district: "Insel", x: -76, z: 10 },
  { id: "mattenhof", district: "Mattenhof", x: -50, z: 25 },
  { id: "liebefeld", district: "Liebefeld", x: -116, z: 94 },
];

export function plotById(id: string | null): Plot | null {
  return PLOTS.find((plot) => plot.id === id) ?? null;
}
