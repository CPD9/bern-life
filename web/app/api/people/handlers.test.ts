import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { HANDLE } from "@/features/accounts/input";
import { DEMO_MEMBERS } from "@/features/people/demo-members";
import { saveOffice } from "@/features/people/store";
import type { Sql } from "@/infrastructure/db";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";
import { NOW, type TestMember, member, request, testDeps } from "../testing";
import { demoOfficeOf, demoPeople, listPeople, officeOf } from "./handlers";

describe("demo members", () => {
  test("no demo handle can be taken at sign-up", () => {
    expect(DEMO_MEMBERS.map((m) => m.handle).filter((handle) => HANDLE.test(handle))).toEqual([]);
  });

  test("with no database the directory is the demo members alone, and only theirs open", async () => {
    const { people } = (await demoPeople().json()) as { people: { handle: string; demo?: true }[] };
    expect(people.map((p) => `${p.handle}:${p.demo === true}`)).toEqual([
      "demo-lena:true",
      "demo-marco:true",
      "demo-sophie:true",
    ]);
    expect([demoOfficeOf("demo-lena").status, demoOfficeOf("bea").status]).toEqual([200, 404]);
  });
});

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("people routes against a throwaway database", () => {
  const sql = testDb as Sql;
  const real = { ...testDeps(sql), demoFixtures: false };
  const fixtures = { ...real, demoFixtures: true };
  let ada: TestMember;

  type Listed = { people: { handle: string; canVisit: boolean; demo?: true }[] };
  const listed = async (as: TestMember | null, deps = real) =>
    ((await (await listPeople(request("/api/people", { as }), deps)).json()) as Listed).people.map(
      (p) => `${p.handle}:${p.canVisit ? "visit" : "-"}${p.demo ? ":demo" : ""}`,
    );
  const visit = async (as: TestMember | null, handle: string, deps = real) =>
    (await officeOf(request(`/api/people/${handle}/office`, { as }), deps, handle)).status;

  beforeEach(async () => {
    await emptyTables(sql);
    ada = await member(sql, "ada");
    const bea = await member(sql, "bea", "public");
    await member(sql, "cem", "private");
    const office = { plot: null, layout: null };
    await saveOffice(sql, bea.id, { ...office, visitVisibility: "members" }, NOW);
  });
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
  });

  test("the directory follows profile visibility, never lists you, and says who may visit", async () => {
    expect(await listed(ada)).toEqual(["bea:visit"]);
    expect(await listed(null)).toEqual(["bea:-"]);
  });

  test("an office opens only as its visit visibility allows", async () => {
    expect([await visit(ada, "bea"), await visit(null, "bea"), await visit(ada, "cem")]).toEqual([
      200, 404, 404,
    ]);
    expect(await visit(ada, "ada")).toBe(200);
  });

  test("demo members exist only under DEMO_FIXTURES, marked demo, with offices open to visit", async () => {
    expect(await listed(null, fixtures)).toEqual([
      "bea:-",
      "demo-lena:visit:demo",
      "demo-marco:visit:demo",
      "demo-sophie:visit:demo",
    ]);
    expect([await visit(null, "demo-lena", fixtures), await visit(null, "demo-lena")]).toEqual([
      200, 404,
    ]);
    expect(await listed(null)).toEqual(["bea:-"]);
  });
});
