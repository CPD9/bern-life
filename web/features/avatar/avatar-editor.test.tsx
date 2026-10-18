import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { type AvatarConfig, defaultAvatar } from "./avatar-config";
import { AvatarEditor } from "./avatar-editor";

function renderEditor(random = () => 0) {
  const changes: AvatarConfig[] = [];
  render(
    <AvatarEditor
      value={defaultAvatar}
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
    expect(changes).toEqual([{ ...defaultAvatar, outfit: "lab-coat" }]);
  });

  test("a skin swatch is named for screen readers", () => {
    const changes = renderEditor();
    fireEvent.click(screen.getByLabelText("Tone 10, deepest"));
    expect(changes).toEqual([{ ...defaultAvatar, skin: "tone-10" }]);
  });

  test("the 3D view is whatever the caller passes in", () => {
    renderEditor();
    expect(screen.getByText("3D preview")).toBeTruthy();
  });

  test("Shuffle draws a whole new avatar from the injected source", () => {
    const changes = renderEditor(() => 0.99);
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(changes).toEqual([
      { body: "broad", skin: "tone-10", hair: "covered", outfit: "field-work", accent: "slate" },
    ]);
  });
});
