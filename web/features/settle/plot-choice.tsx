// The plots as one radio group, so arrow keys move between them; the one you settled on says so.

import { useId } from "react";
import { type Plot, type PlotId } from "./plots";

type PlotChoiceProps = {
  plots: readonly Plot[];
  value: PlotId;
  settledId: PlotId | null;
  onChange: (id: PlotId) => void;
};

export function PlotChoice({ plots, value, settledId, onChange }: PlotChoiceProps) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-sm font-extrabold">Plot</legend>
      <div className="flex flex-wrap gap-1.5">
        {plots.map((plot) => (
          <label
            key={plot.id}
            className="bg-chip rounded-pill has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus cursor-pointer px-3.5 py-1.5 text-sm font-bold has-focus-visible:outline-3"
          >
            <input
              type="radio"
              name={name}
              checked={value === plot.id}
              onChange={() => onChange(plot.id)}
              className="sr-only"
            />
            {plot.district}
            {plot.id === settledId && <span className="font-semibold"> · your office</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
