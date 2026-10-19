import { useId } from "react";

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string | undefined;
  disabled?: boolean;
};

// A real switch: role="switch" with aria-checked, operated by click, Space or Enter.
export function Toggle({ label, checked, onChange, description, disabled = false }: ToggleProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span id={labelId} className="font-bold">
          {label}
        </span>
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
        className={`rounded-pill focus-visible:outline-focus relative h-7 w-12 shrink-0 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          aria-hidden="true"
          className={`bg-panel absolute top-1 left-1 size-5 rounded-full shadow transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
