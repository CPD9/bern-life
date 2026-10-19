import { afterEach, describe, expect, test } from "bun:test";
import { focusOnOpen } from "./focus-on-open";

afterEach(() => {
  document.body.innerHTML = "";
});

function frameWith(...children: HTMLElement[]) {
  const frame = document.createElement("section");
  frame.append(...children);
  document.body.append(frame);
  return frame;
}

describe("focusOnOpen", () => {
  test("the element marked data-autofocus takes focus, wherever it sits in the frame", () => {
    const field = document.createElement("input");
    field.setAttribute("data-autofocus", "");
    const wrapper = document.createElement("div");
    wrapper.append(document.createElement("p"), field);
    const title = document.createElement("h2");
    title.tabIndex = -1;
    const frame = frameWith(title, wrapper);
    focusOnOpen(frame, title);
    expect(document.activeElement).toBe(field);
  });

  test("without a mark the title takes focus, and nothing happens with neither", () => {
    const title = document.createElement("h2");
    title.tabIndex = -1;
    const frame = frameWith(title, document.createElement("p"));
    focusOnOpen(frame, title);
    expect(document.activeElement).toBe(title);
    (document.activeElement as HTMLElement).blur();
    focusOnOpen(null, null);
    expect(document.activeElement).toBe(document.body);
  });

  test("focus never scrolls, so a clipped frame keeps its title bar in view", () => {
    const seen: (FocusOptions | undefined)[] = [];
    const title = { focus: (options?: FocusOptions) => void seen.push(options) };
    focusOnOpen(frameWith(), title);
    expect(seen).toEqual([{ preventScroll: true }]);
  });
});
