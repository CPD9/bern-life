import { useId } from "react";

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string | undefined;
  disabled?: boolean;
};

// An iOS switch: a 51 by 31 pt track with a 27 pt knob that slides in 200 ms, green when on. A
// real switch underneath: role="switch" with aria-checked, operated by click, Space or Enter.
// A disabled row dims as a whole, the way a greyed-out iOS row does.
export function Toggle({ label, checked, onChange, description, disabled = false }: ToggleProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-4 py-1.5 ${disabled ? "opacity-40" : ""}`}
    >
      <div className="flex min-w-0 flex-col">
        <span id={labelId}>{label}</span>
        {description && (
          <span id={descriptionId} className="text-muted text-sm">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`rounded-pill focus-visible:outline-focus relative h-[31px] w-[51px] shrink-0 transition-colors duration-200 ease-in-out focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed motion-reduce:transition-none ${
          checked ? "bg-primary" : "bg-muted/40"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out motion-reduce:transition-none ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
