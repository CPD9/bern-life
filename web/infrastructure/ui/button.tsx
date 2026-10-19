import type { ButtonHTMLAttributes, ReactNode } from "react";

// The kit's buttons, on the shared tokens so they follow light and dark. One green primary action
// per screen; the rest are quiet.
export type ButtonVariant = "primary" | "secondary" | "ghost";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink",
  secondary: "bg-chip text-ink",
  ghost: "text-primary",
};

const base =
  "rounded-pill inline-flex items-center justify-center gap-1.5 font-bold focus-visible:outline-focus focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: ButtonVariant;
  type?: "button" | "submit";
};

export function Button({
  variant = "secondary",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} px-4 py-2 ${variants[variant]} ${className ?? ""}`}
      {...rest}
    />
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  /** The button's accessible name: an icon alone says nothing to a screen reader. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
};

export function IconButton({
  label,
  icon,
  variant = "ghost",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${base} size-10 shrink-0 ${variants[variant]} ${className ?? ""}`}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
