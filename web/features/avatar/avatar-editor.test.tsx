import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { type BearConfig, defaultBear } from "./bear-config";
import { AvatarEditor } from "./avatar-editor";

function renderEditor(value: BearConfig = defaultBear, random = () => 0) {
  const changes: BearConfig[] = [];
  render(
    <AvatarEditor
      value={value}
      onChange={(next) => changes.push(next)}
      preview={<p>3D preview</p>}
      random={random}
    />,
  );
  return changes;
}

describe("AvatarEditor", () => {
  test("choosing an outfit changes only the outfit", () => {
    const changes = renderEditor();
    fireEvent.click(screen.getByLabelText("Lab coat"));
    expect(changes).toEqual([{ ...defaultBear, outfit: "lab-coat" }]);
  });

  test("choosing a kind moves the fur to that kind's first shade", () => {
    const changes = renderEditor();
    fireEvent.click(screen.getByLabelText("Polar bear"));
    expect(changes).toEqual([{ ...defaultBear, kind: "polar-bear", fur: "snow" }]);
  });

  test("only the fur shades of the chosen kind are offered, named for screen readers", () => {
    renderEditor({ ...defaultBear, kind: "panda", fur: "classic" });
    const fur = screen.getByRole("group", { name: "Fur" });
    expect([...fur.querySelectorAll("label")].map((label) => label.textContent)).toEqual([
      "Classic",
      "Qinling",
    ]);
  });

  test("the 3D view is whatever the caller passes in", () => {
    renderEditor();
    expect(screen.getByText("3D preview")).toBeTruthy();
  });

  test("Shuffle draws a whole new bear from the injected source", () => {
    const changes = renderEditor(defaultBear, () => 0.99);
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(changes).toEqual([
      { kind: "ibex", fur: "stone", face: "wink", outfit: "field-work", accessory: "backpack" },
    ]);
  });
});
