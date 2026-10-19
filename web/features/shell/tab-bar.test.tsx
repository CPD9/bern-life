import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { TabBar } from "./tab-bar";

const noop = () => undefined;

test("the Phone tab shows the unread count, and nothing when there is none", () => {
  const { rerender } = render(<TabBar selected="home" onSelect={noop} badges={{ phone: 12 }} />);
  const phone = screen.getByRole("button", { name: "Phone, 12 unread" });
  expect(phone.querySelector("[aria-hidden='true']:not(svg)")?.textContent).toBe("9+");
  rerender(<TabBar selected="home" onSelect={noop} badges={{ phone: null }} />);
  expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
  rerender(<TabBar selected="home" onSelect={noop} badges={{ phone: 0 }} />);
  expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
});
