import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { parseOffice } from "@/features/people/office";
import { directory, saveOffice, visibleOffice } from "@/features/people/store";
import type { Sql } from "@/infrastructure/db";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";
import { parseCode, parseLab, parseProfileId } from "./input";
import {
  acceptLabInvite,
  createLab,
  createLabInvite,
  labFor,
  labsOf,
  leaveLab,
  linkProfile,
  removeMember,
  unlinkProfile,
} from "./store";

const NOW = new Date("2026-10-18T22:00:00Z");
const DAYS = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const SOURCE = "test-labs";
const PROFILE = "person-example-ada-muster";
const LAB = { name: "Glucose Lab", unit: "Diabetes Center", description: null };

describe("labs and office input", () => {
  test("a lab needs a name; unit and description are optional and bounded", () => {
    expect(parseLab({ name: "  Glucose Lab ", unit: "", description: "CGM" })).toEqual({
      name: "Glucose Lab",
      unit: null,
      description: "CGM",
    });
    expect([
      parseLab({}),
      parseLab({ name: "x".repeat(81) }),
      parseLab({ name: "Lab", description: "y".repeat(501) }),
      parseLab({ name: "Lab\u0007" }),
    ]).toEqual([null, null, null, null]);
    expect([parseCode({ code: " AB-CD " }), parseProfileId({ profileId: 7 })]).toEqual([
      "AB-CD",
      null,
    ]);
  });

  test("an office is private by default; plot and layout must be JSON objects of sane size", () => {
    expect(parseOffice({})).toEqual({ plot: null, layout: null, visitVisibility: "private" });
    expect(
      parseOffice({
        plot: { district: "Länggasse", n: 3 },
        layout: [],
        visitVisibility: "members",
      }),
    ).toEqual({ plot: { district: "Länggasse", n: 3 }, layout: [], visitVisibility: "members" });
    expect([
      parseOffice({ visitVisibility: "friends" }),
      parseOffice({ plot: "Länggasse" }),
      parseOffice({ layout: { items: "x".repeat(16_400) } }),
      parseOffice([]),
    ]).toEqual([null, null, null, null]);
  });
});

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("labs against a throwaway database", () => {
  const sql = testDb as Sql;
  let ada = "";
  let bea = "";
  let cem = "";

  async function person(handle: string): Promise<string> {
    const [row] = await sql<{ id: string }[]>`insert into app_user (id, handle, display_name)
      values (gen_random_uuid(), ${handle}, ${handle.toUpperCase()}) returning id`;
    return (row as { id: string }).id;
  }

  async function adasLab(): Promise<string> {
    const lab = await createLab(sql, ada, LAB, NOW);
    if (lab === "lab_exists") throw new Error("expected a new lab");
    return lab.id;
  }

  async function join(labId: string, who: string): Promise<void> {
    const invite = await createLabInvite(sql, ada, labId, NOW);
    if (invite === "not_lead") throw new Error("expected an invite");
    await acceptLabInvite(sql, who, invite.code, NOW);
  }

  const handles = async (labId: string) =>
    (await labFor(sql, ada, labId))?.members.map((m) => `${m.handle}:${m.role}`);

  beforeEach(async () => {
    await emptyTables(sql);
    await sql`delete from source where id = ${SOURCE}`;
    [ada, bea, cem] = [await person("ada"), await person("bea"), await person("cem")];
  });
  afterAll(async () => {
    await emptyTables(sql);
    await sql`delete from source where id = ${SOURCE}`;
    await sql.end();
  });

  test("the creator leads one lab and is its first member", async () => {
    const id = await adasLab();
    expect(await labsOf(sql, ada)).toEqual([{ id, ...LAB, role: "lead" }]);
    expect(await createLab(sql, ada, { ...LAB, name: "Second" }, NOW)).toBe("lab_exists");
    expect(await handles(id)).toEqual(["ada:lead"]);
  });

  test("only the lead invites and removes; a code works once and only until it expires", async () => {
    const id = await adasLab();
    const invite = await createLabInvite(sql, ada, id, NOW);
    if (invite === "not_lead") throw new Error("expected an invite");
    expect(invite.expiresAt).toEqual(DAYS(7));
    expect(await acceptLabInvite(sql, bea, invite.code.toLowerCase(), NOW)).toBe(id);
    expect(await acceptLabInvite(sql, cem, invite.code, NOW)).toBe("invite_invalid");
    expect(await createLabInvite(sql, bea, id, NOW)).toBe("not_lead");

    const late = await createLabInvite(sql, ada, id, NOW);
    if (late === "not_lead") throw new Error("expected an invite");
    expect(await acceptLabInvite(sql, cem, late.code, DAYS(8))).toBe("invite_invalid");
    await join(id, cem);
    expect(await handles(id)).toEqual(["ada:lead", "bea:member", "cem:member"]);

    expect(await removeMember(sql, bea, id, "cem")).toBe("not_lead");
    expect(await removeMember(sql, ada, id, "ada")).toBe("not_found");
    expect(await removeMember(sql, ada, id, "cem")).toBe("removed");
    expect(await leaveLab(sql, ada, id)).toBe("lead");
    expect(await leaveLab(sql, bea, id)).toBe("left");
    expect(await leaveLab(sql, cem, id)).toBe("not_member");
    expect(await handles(id)).toEqual(["ada:lead"]);
  });

  test("a listing never creates a user, and the profile must exist", async () => {
    await sql`insert into source (id, name) values (${SOURCE}, 'Test source')`;
    await sql`insert into profile (id, kind, source_id, name, source_url)
              values (${PROFILE}, 'person', ${SOURCE}, 'Ada Muster', 'https://example.org/ada')`;
    const id = await adasLab();
    await join(id, bea);
    const users = async () =>
      (await sql<{ n: number }[]>`select count(*)::int as n from app_user`)[0]?.n;
    const before = await users();

    expect(await linkProfile(sql, bea, id, PROFILE, NOW)).toBe("linked");
    expect(await linkProfile(sql, bea, id, "person-nobody", NOW)).toBe("unknown_profile");
    expect(await linkProfile(sql, cem, id, PROFILE, NOW)).toBe("not_member");
    expect(await users()).toBe(before);
    expect((await labFor(sql, ada, id))?.listings).toEqual([
      {
        profileId: PROFILE,
        name: "Ada Muster",
        kind: "person",
        sourceUrl: "https://example.org/ada",
        addedBy: { handle: "bea", displayName: "BEA" },
      },
    ]);
    expect(await handles(id)).toEqual(["ada:lead", "bea:member"]);

    await join(id, cem);
    expect(await unlinkProfile(sql, cem, id, PROFILE)).toBe(false);
    expect(await unlinkProfile(sql, ada, id, PROFILE)).toBe(true);
  });

  test("a lab is read by its members only", async () => {
    const id = await adasLab();
    await join(id, bea);
    expect((await labFor(sql, bea, id))?.name).toBe("Glucose Lab");
    expect([await labFor(sql, cem, id), await labsOf(sql, cem)]).toEqual([null, []]);
  });

  test("the directory and offices follow each person's visit visibility", async () => {
    const office = (visitVisibility: "private" | "members" | "public") => ({
      plot: { district: "Länggasse" },
      layout: [{ item: "desk", x: 1, z: 2, turn: 0 }],
      visitVisibility,
    });
    await saveOffice(sql, ada, office("private"), NOW);
    await saveOffice(sql, bea, office("members"), NOW);
    await saveOffice(sql, cem, office("public"), NOW);
    const listed = async (viewer: string | null) =>
      (await directory(sql, viewer)).map((p) => p.handle);
    expect(await listed(ada)).toEqual(["ada", "bea", "cem"]);
    expect(await listed(bea)).toEqual(["bea", "cem"]);
    expect(await listed(null)).toEqual(["cem"]);

    const visits = async (viewer: string | null) => {
      const seen = [];
      for (const handle of ["ada", "bea", "cem"])
        seen.push((await visibleOffice(sql, viewer, handle)) !== null);
      return seen;
    };
    expect(await visits(ada)).toEqual([true, true, true]);
    expect(await visits(cem)).toEqual([false, true, true]);
    expect(await visits(null)).toEqual([false, false, true]);
    expect(await visibleOffice(sql, null, "cem")).toEqual({
      handle: "cem",
      displayName: "CEM",
      ...office("public"),
    });
  });
});
