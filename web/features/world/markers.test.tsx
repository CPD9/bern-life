import { describe, expect, mock, test } from "bun:test";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { type Building } from "./buildings";
import { PlaceMarkers } from "./markers/place-markers";
import { PlacePanel } from "./place-panel";
import { type Place } from "./places";
import { AgentButtons } from "./scene/agents";

const addressed: Place = {
  id: "example-lab",
  name: "Example Sensor Lab",
  source_id: "example",
  host: "www.example-institute.test",
  kind: "institute",
  x: 1,
  z: 2,
  position_method: "address",
  address: "Musterstrasse 5",
  address_url: "https://www.example-institute.test/contact",
  address_span: "Musterstrasse 5",
  address_fetched_at: "2026-10-18T12:00:00Z",
  address_page_sha256: "a".repeat(64),
};

const district: Place = {
  ...addressed,
  id: "example-network",
  name: "Example Network",
  host: "network.example-institute.test",
  kind: "centre",
  position_method: "district",
  address: null,
  address_url: null,
  address_span: null,
  address_fetched_at: null,
  address_page_sha256: null,
};

const shared: Building = {
  key: "musterstrasse 5",
  x: 1,
  z: 2,
  kind: "institute",
  places: [addressed, district],
};

function anchors() {
  const ref = createRef<Map<string, HTMLElement>>() as { current: Map<string, HTMLElement> };
  ref.current = new Map();
  return ref;
}

describe("PlacePanel", () => {
  test("lists every unit with its address and source, and says positions are approximate", () => {
    render(<PlacePanel building={shared} onClose={() => undefined} />);
    expect(screen.getByRole("heading", { name: "2 units here" })).toBeTruthy();
    expect(screen.getByText("Example Sensor Lab")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Source page" }).getAttribute("href")).toBe(
      "https://www.example-institute.test/contact",
    );
    expect(screen.getByText(/placed in its district/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Website" }).getAttribute("href")).toBe(
      "https://network.example-institute.test/",
    );
    expect(
      screen.getByText("Position placed by hand from the address; approximate (street level)."),
    ).toBeTruthy();
  });

  test("Close calls back and the heading takes focus on open", () => {
    const onClose = mock(() => undefined);
    render(<PlacePanel building={shared} onClose={onClose} />);
    expect(document.activeElement?.textContent).toBe("2 units here");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("PlaceMarkers", () => {
  test("one same-size button per building, named by its units, with a count when shared", () => {
    const onSelect = mock((key: string) => key);
    const elements = anchors();
    render(
      <PlaceMarkers
        buildings={[shared]}
        selectedKey={null}
        onSelect={onSelect}
        elementsRef={elements}
      />,
    );
    const marker = screen.getByRole("button", {
      name: "Example Sensor Lab · Example Network (Institute)",
    });
    expect(marker.getAttribute("aria-pressed")).toBe("false");
    expect(marker.textContent).toContain("2");
    expect([...elements.current.keys()]).toEqual(["musterstrasse 5"]);
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith("musterstrasse 5");
  });
});

describe("AgentButtons", () => {
  test("without a handler each agent says it is coming soon", () => {
    render(<AgentButtons onSelect={undefined} elementsRef={anchors()} />);
    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Navigator, coming soon", "Scout, coming soon", "Matchmaker, coming soon"]);
  });

  test("with a handler a click passes the agent's stable id", () => {
    const onSelect = mock((id: string) => id);
    render(<AgentButtons onSelect={onSelect} elementsRef={anchors()} />);
    fireEvent.click(screen.getByRole("button", { name: "Navigator" }));
    expect(onSelect).toHaveBeenCalledWith("navigator");
  });
});
