// The desktop's windows as a stack: the last window is on top and has focus. One window per app,
// so opening an app that is already open only brings it to the front.
export type DesktopWindow = { readonly appId: string; readonly x: number; readonly y: number };

export type WindowStack = readonly DesktopWindow[];

export type Bounds = { readonly width: number; readonly height: number };

const cascadeStart = { x: 24, y: 24 } as const;
const cascadeStep = { x: 40, y: 32 } as const;
/** How much of a window stays on the desktop, so its title bar can always be grabbed again. */
const keepVisible = { x: 160, y: 48 } as const;

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

function placed(appId: string, x: number, y: number, bounds: Bounds): DesktopWindow {
  return {
    appId,
    x: clamp(x, bounds.width - keepVisible.x),
    y: clamp(y, bounds.height - keepVisible.y),
  };
}

export function topWindow(stack: WindowStack): DesktopWindow | undefined {
  return stack.at(-1);
}

export function focusWindow(stack: WindowStack, appId: string): WindowStack {
  const window = stack.find((candidate) => candidate.appId === appId);
  if (!window || topWindow(stack) === window) return stack;
  return [...stack.filter((candidate) => candidate !== window), window];
}

export function openWindow(stack: WindowStack, appId: string, bounds: Bounds): WindowStack {
  if (stack.some((window) => window.appId === appId)) return focusWindow(stack, appId);
  const n = stack.length;
  const x = cascadeStart.x + n * cascadeStep.x;
  const y = cascadeStart.y + n * cascadeStep.y;
  return [...stack, placed(appId, x, y, bounds)];
}

export function closeWindow(stack: WindowStack, appId: string): WindowStack {
  return stack.filter((window) => window.appId !== appId);
}

/** +1 brings the bottom window to the front; -1 sends the front window to the back. */
export function cycleWindows(stack: WindowStack, step: 1 | -1): WindowStack {
  if (stack.length < 2) return stack;
  if (step === 1) return [...stack.slice(1), ...stack.slice(0, 1)];
  return [...stack.slice(-1), ...stack.slice(0, -1)];
}

export function moveWindow(
  stack: WindowStack,
  appId: string,
  dx: number,
  dy: number,
  bounds: Bounds,
): WindowStack {
  return stack.map((window) =>
    window.appId === appId ? placed(appId, window.x + dx, window.y + dy, bounds) : window,
  );
}
