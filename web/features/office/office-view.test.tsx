import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { OfficeView } from "./office-view";

test("the office offers the computer and the door", () => {
  const onUseDesk = mock(() => undefined);
  const onGoOutside = mock(() => undefined);
  render(<OfficeView onUseDesk={onUseDesk} onGoOutside={onGoOutside} />);
  expect(screen.getByRole("heading", { name: "Your office" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Use the computer" }));
  expect(onUseDesk).toHaveBeenCalledTimes(1);
  expect(onGoOutside).toHaveBeenCalledTimes(0);
  fireEvent.click(screen.getByRole("button", { name: "Go outside" }));
  expect(onGoOutside).toHaveBeenCalledTimes(1);
});
