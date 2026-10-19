import { describe, expect, test } from "bun:test";
import { type Building } from "./buildings";
import { DOOR_REACH, doorName, doorNear, homeDoor, placeDoor } from "./doors";
import { type MapPoint } from "./geography";
import { type Place } from "./places";

const unit = (id: string, name: string): Place => ({
  id,
  name,
  source_id: "example",
  host: "www.example-institute.test",
  kind: "institute",
  x: 10,
  z: 20,
  position_method: "address",
  address: "Musterstrasse 5",
  address_url: "https://www.example-institute.test/contact",
  address_span: "Musterstrasse 5",
  address_fetched_at: "2026-10-18T12:00:00Z",
  address_page_sha256: "a".repeat(64),
});

const lab: Building = {
  key: "musterstrasse 5",
  x: 10,
  z: 20,
  kind: "institute",
  places: [unit("example-lab", "Example Sensor Lab")],
};
const shared: Building = {
  ...lab,
  places: [...lab.places, unit("example-network", "Example Network"), unit("x", "Example X")],
};

describe("a place's door", () => {
  test("is in front, toward the default camera, when nothing stands there", () => {
    expect(placeDoor(lab, () => true)).toEqual({
      key: "musterstrasse 5",
      kind: "place",
      at: [10, 21.85],
      name: "Example Sensor Lab",
    });
  });

  test("moves round to the first side that is not built up: east, then west, then north", () => {
    const southBuilt = ([, z]: MapPoint) => z <= 20;
    expect(placeDoor(lab, southBuilt).at).toEqual([11.85, 20]);
    const onlyWest = ([x]: MapPoint) => x < 10;
    expect(placeDoor(lab, onlyWest).at).toEqual([8.15, 20]);
    const onlyNorth = ([, z]: MapPoint) => z < 20;
    expect(placeDoor(lab, onlyNorth).at).toEqual([10, 18.15]);
  });

  test("is named for the first unit, with a count when it holds more", () => {
    expect(doorName(shared)).toBe("Example Sensor Lab and 2 more");
  });
});

describe("your office door", () => {
  test("stands in front of the office, which sits at the back of its lot", () => {
    const door = homeDoor([-50, 25]);
    expect([door.key, door.kind, door.name]).toEqual(["home", "home", "your office"]);
    expect(door.at[0]).toBe(-50);
    expect(door.at[1]).toBeCloseTo(25.65, 12);
  });
});

describe("standing at a door", () => {
  const doors = [placeDoor(lab, () => true), homeDoor([10, 25])];

  test("within reach offers that door, at the edge too; one step further offers none", () => {
    expect(doorNear(doors, [10, 21.85])?.key).toBe("musterstrasse 5");
    expect(doorNear(doors, [10 + DOOR_REACH, 21.85])?.key).toBe("musterstrasse 5");
    expect(doorNear(doors, [10 + DOOR_REACH + 0.01, 21.85])).toBeNull();
  });

  test("between two doors offers the nearer", () => {
    expect(doorNear(doors, [10, 24.5])?.key).toBe("home");
    expect(doorNear(doors, [10, 22.5])?.key).toBe("musterstrasse 5");
  });
});
