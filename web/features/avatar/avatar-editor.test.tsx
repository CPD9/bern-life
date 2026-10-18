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
      lite
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

  test("Shuffle draws a whole new avatar from the injected source", () => {
    const changes = renderEditor(() => 0.99);
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(changes).toEqual([
      { body: "broad", skin: "tone-10", hair: "covered", outfit: "field-work", accent: "slate" },
    ]);
  });

  test("the arrow keys turn the figure in 15 degree steps", () => {
    renderEditor();
    const turntable = screen.getByRole("slider", { name: "Turn your avatar" });
    fireEvent.keyDown(turntable, { key: "ArrowLeft" });
    expect(turntable.getAttribute("aria-valuenow")).toBe("345");
    fireEvent.keyDown(turntable, { key: "Home" });
    expect(turntable.getAttribute("aria-valuetext")).toBe("Facing you");
  });
});
