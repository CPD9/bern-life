import { describe, expect, test } from "bun:test";
import { defaultBear } from "@/features/avatar/bear-config";
import { saveToAccount } from "./save-to-account";

const profile = { role: "company", goal: "collaborator", visibility: "private" } as const;

describe("saveToAccount", () => {
  test("PUTs the answers and the bear to the profile route", async () => {
    const calls: { path: string; method: string | undefined; body: unknown }[] = [];
    const saved = await saveToAccount(
      async (path, init) => {
        calls.push({ path, method: init.method, body: JSON.parse(String(init.body)) });
        return new Response(null, { status: 204 });
      },
      profile,
      defaultBear,
    );
    expect(saved).toBe(true);
    expect(calls).toEqual([
      {
        path: "/api/auth/me/profile",
        method: "PUT",
        body: {
          role: "company",
          goal: "collaborator",
          expertise: [],
          visibility: "private",
          avatar: {
            kind: "brown-bear",
            fur: "honey",
            face: "happy",
            outfit: "casual",
            accessory: "scarf",
          },
        },
      },
    ]);
  });

  test("a refused or failed request reports false and never throws", async () => {
    expect(
      await saveToAccount(async () => new Response(null, { status: 401 }), profile, defaultBear),
    ).toBe(false);
    expect(
      await saveToAccount(
        async () => {
          throw new TypeError("offline");
        },
        profile,
        defaultBear,
      ),
    ).toBe(false);
  });
});
