import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import placePeopleFixture from "../../../contracts/fixtures/place-people.json";
import { parsePlacePeople } from "@/infrastructure/contract";
import type { PlacePeople } from "@/infrastructure/contract-types.generated";
import { type Building } from "./buildings";
import { PlacePanel } from "./place-panel";
import { type Place } from "./places";

const fixture = parsePlacePeople(placePeopleFixture)!;
const ada = fixture.people[0]!;
const real: PlacePeople = {
  snapshot: "local-abc",
  people: [{ ...ada, source_url: "https://www.example-institute.test/team/ada-muster" }],
  total: 41,
};

const place: Place = {
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

const building: Building = {
  key: "musterstrasse 5",
  x: 1,
  z: 2,
  kind: "institute",
  places: [place],
};

function panel(load: (p: Place) => Promise<PlacePeople | null>) {
  return render(
    <PlacePanel
      building={building}
      light={undefined}
      fixture={false}
      onClose={() => undefined}
      onSearchHere={undefined}
      loadPeople={load}
    />,
  );
}

describe("PeopleCard beside the place", () => {
  test("lists the place's people with role, unit and source page, and the count", async () => {
    const load = mock(async (asked: Place) => (asked.id === place.id ? real : null));
    panel(load);
    expect(await screen.findByText(ada.name.value)).toBeTruthy();
    expect(load.mock.calls).toEqual([[place]]);
    const card = document.querySelector("[data-place-people]")!;
    expect(card.textContent).toContain(ada.fields.role[0]!.value);
    expect(card.textContent).toContain("1 of 41 listed");
    expect(card.querySelector("a")!.getAttribute("href")).toBe(
      "https://www.example-institute.test/team/ada-muster",
    );
    expect(card.textContent).not.toContain("FIXTURE");
    expect(card.textContent).not.toMatch(/@|\+41/);
    // The place card comes first, so a phone shows the place before its people.
    const panelRoot = document.querySelector("[data-place-panel]")!;
    expect(panelRoot.firstElementChild!.tagName).toBe("SECTION");
    expect(panelRoot.lastElementChild!.hasAttribute("data-place-people")).toBe(true);
  });

  test("a place without profiles says so", async () => {
    panel(async () => ({ snapshot: "local-abc", people: [], total: 0 }));
    expect(await screen.findByText("No profiles listed for this unit yet")).toBeTruthy();
  });

  test("fixture people carry the FIXTURE label and no link to an invented page", async () => {
    panel(async () => fixture);
    expect(await screen.findByText("FIXTURE")).toBeTruthy();
    const card = document.querySelector("[data-place-people]")!;
    expect(card.querySelector("a")).toBeNull();
    expect(card.textContent).toContain("Fixture source, not a real page");
  });

  test("an engine that does not answer leaves a plain note", async () => {
    panel(async () => null);
    expect(await screen.findByText("The profiles could not be loaded right now.")).toBeTruthy();
  });
});
