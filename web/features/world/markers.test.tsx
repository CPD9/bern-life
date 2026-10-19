import { describe, expect, mock, test } from "bun:test";
import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type Building, groupPlacesByBuilding } from "./buildings";
import { worldDemoSearch } from "./demo-search";
import { lightUp } from "./light";
import { PlaceMarkers } from "./markers/place-markers";
import { PlacePanel } from "./place-panel";
import { PLACES, type Place } from "./places";
import { AGENT_KEY, AgentButton, agentAnchor } from "./scene/agents";

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
    render(
      <PlacePanel
        building={shared}
        light={undefined}
        fixture={false}
        onClose={() => undefined}
        onSearchHere={undefined}
      />,
    );
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

  test("opening a place tells the story the lobby was entered, once", () => {
    const emit = mock((name: string) => name);
    render(
      <PlacePanel
        building={shared}
        light={undefined}
        fixture={false}
        onClose={() => undefined}
        onSearchHere={undefined}
        events={{ emit }}
      />,
    );
    expect(emit.mock.calls).toEqual([["lobby_entered"]]);
  });

  test("Close calls back and the heading takes focus on open", () => {
    const onClose = mock(() => undefined);
    render(
      <PlacePanel
        building={shared}
        light={undefined}
        fixture={false}
        onClose={onClose}
        onSearchHere={undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Search here" })).toBeNull();
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
        searching={false}
        lighting={null}
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

describe("the agent on the map", () => {
  test("its label follows the agent: read again on every frame, above its ears", () => {
    let feet: [number, number, number] = [21.9, 0, -7];
    const anchor = agentAnchor(() => feet);
    expect(anchor.key).toBe(AGENT_KEY);
    expect(anchor.position).toEqual([21.9, 2.9, -7]);
    feet = [3, 1.5, 12];
    expect(anchor.position).toEqual([3, 4.4, 12]);
  });

  test("has one button, named for the agent, registered at one anchor", () => {
    const elements = anchors();
    render(<AgentButton name="Bärli" onOpen={() => undefined} elementsRef={elements} />);
    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Bärli, your agent"]);
    expect([...elements.current.keys()]).toEqual([AGENT_KEY]);
  });

  test("a tap opens it once; it is a page button, so Enter and Space reach it too", () => {
    const onOpen = mock(() => undefined);
    render(<AgentButton name="Lumi" onOpen={onOpen} elementsRef={anchors()} />);
    const button = screen.getByRole("button", { name: "Lumi, your agent" });
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    expect([button.tagName, button.getAttribute("type")]).toEqual(["BUTTON", "button"]);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("while a search runs", () => {
  test("every marker breathes, unless the viewer asked for reduced motion", () => {
    render(
      <PlaceMarkers
        buildings={[shared]}
        selectedKey={null}
        onSelect={() => undefined}
        elementsRef={anchors()}
        searching={true}
        lighting={null}
      />,
    );
    expect(screen.getByRole("button").className).toContain("motion-safe:animate-pulse");
  });
});

describe("after a search", () => {
  const buildings = groupPlacesByBuilding(PLACES);
  const lighting = lightUp(worldDemoSearch(), buildings);
  const artorg = buildings.find((building) => building.key === "murtenstrasse 50");
  const inf = buildings.find((building) => building.key === "neubrückstrasse 10");
  if (artorg === undefined || inf === undefined) throw new Error("places changed");

  test("a lit marker says its matches and best rank; an unlit one steps back", () => {
    render(
      <PlaceMarkers
        buildings={[artorg, inf]}
        selectedKey={null}
        onSelect={() => undefined}
        elementsRef={anchors()}
        searching={false}
        lighting={lighting}
      />,
    );
    const lit = screen.getByRole("button", { name: /^ARTORG/ });
    expect(lit.getAttribute("aria-label")).toBe(
      "ARTORG Center for Biomedical Engineering Research · Clinical Neuroscience Bern (Centre), 2 matches, best rank 2",
    );
    expect(lit.style.boxShadow).toBe("0 0 0 8.95px rgb(47 179 107 / 0.63)");
    expect(
      screen.getByRole("button", { name: /^Institute of Computer Science/ }).style.opacity,
    ).toBe("0.6");
  });

  test("the panel lists the matches; fixture sources are text, not links", () => {
    render(
      <PlacePanel
        building={artorg}
        light={lighting.byBuilding.get(artorg.key)}
        fixture={true}
        onClose={() => undefined}
        onSearchHere={undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: /2 matches here/ })).toBeTruthy();
    expect(screen.getByText("Beat Beispiel")).toBeTruthy();
    expect(screen.getByText("Works on wearable biosensors.")).toBeTruthy();
    expect(
      screen.getByText(
        "Fixture source, not a real page: https://www.artorg.unibe.ch/fixture/beat-beispiel",
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Source page",
      "Source page",
    ]);
  });

  test("real results show as result cards; Search here passes the building back", () => {
    const onSearchHere = mock((building: Building) => building.key);
    render(
      <PlacePanel
        building={artorg}
        light={lighting.byBuilding.get(artorg.key)}
        fixture={false}
        onClose={() => undefined}
        onSearchHere={onSearchHere}
      />,
    );
    expect(screen.queryByText(/Fixture source/)).toBeNull();
    expect(screen.getAllByRole("article").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Search here" }));
    expect(onSearchHere).toHaveBeenCalledWith(artorg);
  });
});
