type Focusable = Pick<HTMLElement, "focus">;

/**
 * Where focus lands when an app opens in the phone or in a desk window: the element the app
 * marked `data-autofocus` (Ask marks its search field, so a question can be typed at once), else
 * the window's title, so focus never falls to <body>. Without scrolling: the frame around an app
 * is clipped, and a focus that scrolled it would carry the title bar out of view.
 */
export function focusOnOpen(frame: ParentNode | null, title: Focusable | null): void {
  const target = frame?.querySelector<HTMLElement>("[data-autofocus]") ?? title;
  target?.focus({ preventScroll: true });
}
