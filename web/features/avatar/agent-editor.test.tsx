import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentEditor } from "./agent-editor";

describe("AgentEditor", () => {
  test("the name starts as Bärli and a new one is passed on as typed", () => {
    const names: string[] = [];
    render(
      <AgentEditor
        name="Bärli"
        onNameChange={(next) => names.push(next)}
        bearEditor={<p>Bear editor</p>}
      />,
    );
    const field = screen.getByLabelText("Name") as HTMLInputElement;
    expect([field.value, field.maxLength]).toEqual(["Bärli", 24]);
    fireEvent.change(field, { target: { value: "Mutz" } });
    expect(names).toEqual(["Mutz"]);
    expect(screen.getByText("Bear editor")).toBeTruthy();
  });
});
