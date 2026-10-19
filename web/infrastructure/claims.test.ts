import { describe, expect, test } from "bun:test";
import { copyOf, resultFixture, viaFixture } from "@/test/fixtures";
import { citedClaims, citesNoOwnClaim } from "./claims";

const ownResult = () => copyOf(resultFixture.results[0]!);
const teamResult = () => copyOf(viaFixture.results[1]!);

describe("citedClaims", () => {
  test("resolves pointers into the profile's own claims", () => {
    const result = ownResult();
    expect(citedClaims(result).map(({ pointer }) => pointer)).toEqual(result.reason.cites);
  });

  test("resolves a pointer into the claims of the project the result is shown through", () => {
    const result = teamResult();
    expect(citedClaims(result)).toEqual([
      { pointer: "/via/related_claims/0", claim: result.via!.related_claims[0]! },
    ]);
  });

  test("drops a pointer to a claim the result does not carry", () => {
    const result = teamResult();
    result.reason = {
      text: "Works on PlateScan",
      cites: ["/via/related_claims/3", "/fields/role/9"],
    };
    expect(citedClaims(result)).toEqual([]);
  });
});

describe("citesNoOwnClaim", () => {
  test("is true for the name alone and for the project's claims alone", () => {
    const named = ownResult();
    named.reason = { text: "Name: Ada Example", cites: ["/name"] };
    expect(citesNoOwnClaim(named)).toBe(true);
    expect(citesNoOwnClaim(teamResult())).toBe(true);
  });

  test("is false once a claim of the profile's own is cited", () => {
    const result = teamResult();
    result.reason = {
      text: "Role: Project team",
      cites: ["/fields/role/0", "/via/related_claims/0"],
    };
    expect(citesNoOwnClaim(result)).toBe(false);
    expect(citesNoOwnClaim(ownResult())).toBe(false);
  });
});
