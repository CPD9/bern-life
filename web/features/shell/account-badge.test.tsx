import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AccountBadge, inkOn } from "./account-badge";

describe("AccountBadge", () => {
  test("signed out, it offers to join and comes back to onboarding", () => {
    render(<AccountBadge account={{ status: "signed-out" }} />);
    expect(screen.getByRole("link", { name: "Join Bern Life" }).getAttribute("href")).toBe(
      "/account?next=/start",
    );
  });

  test("signed in, it shows the handle with an initial on the bear's fur colour", () => {
    render(<AccountBadge account={{ status: "signed-in", handle: "ada", colour: "#5e3b26" }} />);
    const link = screen.getByRole("link", { name: "Your account, @ada" });
    expect(link.textContent).toBe("A@ada");
    expect(link.querySelector("span")!.getAttribute("style")).toBe(
      "background-color: #5e3b26; color: #ffffff;",
    );
  });

  test("signed in with the You sheet, the badge is a button that opens it", () => {
    const opened: string[] = [];
    render(
      <AccountBadge
        account={{ status: "signed-in", handle: "ada", colour: "#5e3b26" }}
        onOpen={() => opened.push("you")}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "You, @ada" }));
    expect(opened).toEqual(["you"]);
  });

  test("while the account is checked, it shows nothing", () => {
    const { container } = render(<AccountBadge account={{ status: "checking" }} />);
    expect(container.textContent).toBe("");
  });
});

test("the initial's ink follows the fur: dark on snow, white on cocoa", () => {
  expect(inkOn("#f3f1ea")).toBe("#14202b");
  expect(inkOn("#5e3b26")).toBe("#ffffff");
});
