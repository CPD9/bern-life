import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ComingNext, comingNextText } from "./coming-next";
import { type PhoneApp, Phone } from "./phone";

const apps: PhoneApp[] = [
  { id: "ask", label: "Ask", icon: null, tile: "#13804a", content: <p>Ask content</p> },
  {
    id: "messages",
    label: "Messages",
    icon: null,
    tile: "#1d6fd6",
    content: <ComingNext text={comingNextText.messages} />,
  },
];

function Harness() {
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Phone
      </button>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <Phone
        open={open}
        onClose={() => setOpen(false)}
        apps={apps}
        appId={appId}
        onAppChange={setAppId}
        now={null}
      />
    </>
  );
}

function openPhone() {
  const opener = screen.getByRole("button", { name: "Phone" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("Phone", () => {
  test("opens as a modal dialog with the app grid", () => {
    render(<Harness />);
    openPhone();
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Messages" })).toBeTruthy();
  });

  test("an app opens inside the phone and Apps goes back to the grid", () => {
    render(<Harness />);
    openPhone();
    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    expect(screen.getByText(comingNextText.messages)).toBeTruthy();
    expect(screen.getByText("Coming next")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apps" }));
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });

  test("Close shuts the phone and gives focus back to what opened it", async () => {
    render(<Harness />);
    const opener = openPhone();
    screen.getByRole("button", { name: "Ask" }).focus();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(document.querySelector("dialog")!.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  test("closing by Escape (the dialog's close event) also reports the phone closed", async () => {
    render(<Harness />);
    const opener = openPhone();
    await act(async () => {
      document.querySelector("dialog")!.dispatchEvent(new Event("close"));
    });
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(document.activeElement).toBe(opener);
  });
});
