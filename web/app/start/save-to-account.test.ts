import { describe, expect, test } from "bun:test";
import { parseProfile } from "@/features/accounts/input";
import { agentNameMaxLength } from "@/features/avatar/agent-name";
import { defaultBear } from "@/features/avatar/bear-config";
import { defaultPerson } from "@/features/avatar/person-config";
import { type AccountAvatar, saveToAccount } from "./save-to-account";

const profile = { role: "company", goal: "collaborator", visibility: "private" } as const;
const avatar: AccountAvatar = {
  person: defaultPerson,
  agent: { name: "Bärli", bear: defaultBear },
};

async function sentBody(look: AccountAvatar): Promise<unknown> {
  let body: unknown;
  await saveToAccount(
    async (_path, init) => {
      body = JSON.parse(String(init.body));
      return new Response(null, { status: 204 });
    },
    profile,
    look,
  );
  return body;
}

describe("saveToAccount", () => {
  test("PUTs the answers, the person and the agent with its bear to the profile route", async () => {
    const calls: { path: string; method: string | undefined; body: unknown }[] = [];
    const saved = await saveToAccount(
      async (path, init) => {
        calls.push({ path, method: init.method, body: JSON.parse(String(init.body)) });
        return new Response(null, { status: 204 });
      },
      profile,
      avatar,
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
            person: {
              body: "medium",
              skin: "tone-4",
              hair: "short",
              outfit: "casual",
              accent: "green",
            },
            agent: {
              name: "Bärli",
              bear: {
                kind: "brown-bear",
                fur: "honey",
                face: "happy",
                outfit: "casual",
                accessory: "scarf",
              },
            },
          },
        },
      },
    ]);
  });

  test("the profile route accepts the body unchanged, even with the longest agent name", async () => {
    const longest = { ...avatar, agent: { ...avatar.agent, name: "W".repeat(agentNameMaxLength) } };
    expect(parseProfile(await sentBody(longest))).toEqual({
      role: "company",
      goal: "collaborator",
      expertise: [],
      visibility: "private",
      avatar: longest,
    });
  });

  test("a refused or failed request reports false and never throws", async () => {
    expect(
      await saveToAccount(async () => new Response(null, { status: 401 }), profile, avatar),
    ).toBe(false);
    expect(
      await saveToAccount(
        async () => {
          throw new TypeError("offline");
        },
        profile,
        avatar,
      ),
    ).toBe(false);
  });
});
