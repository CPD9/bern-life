import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentEditor } from "./agent-editor";

describe("AgentEditor", () => {
  test("the name starts as Lumi and a new one is passed on as typed", () => {
    const names: string[] = [];
    render(
      <AgentEditor
        name="Lumi"
        onNameChange={(next) => names.push(next)}
        bearEditor={<p>Bear editor</p>}
      />,
    );
    const field = screen.getByLabelText("Name") as HTMLInputElement;
    expect([field.value, field.maxLength]).toEqual(["Lumi", 24]);
    fireEvent.change(field, { target: { value: "Bärli" } });
    expect(names).toEqual(["Bärli"]);
    expect(screen.getByText("Bear editor")).toBeTruthy();
  });
});
