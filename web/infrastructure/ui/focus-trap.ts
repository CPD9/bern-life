import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// Focus handling shared by the kit's dialogs: what can take focus inside a container, and keeping
// Tab and Shift+Tab inside it.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest("[inert]"),
  );
}

/** Call from a keydown handler: wraps Tab at either end of the container. */
export function keepTabInside(event: KeyboardEvent | ReactKeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;
  const items = focusableIn(container);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
