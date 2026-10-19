import { describe, expect, test } from "bun:test";
import placePeople from "../../../../contracts/fixtures/place-people.json";
import { createEngineClient } from "@/infrastructure/engine-client";
import { placePeople as proxy } from "./proxy";

function engineAnswering(answer: () => Response) {
  const asked: string[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (url) => {
      asked.push(url.pathname);
      return answer();
    },
    logError: () => {},
    timeoutMs: 1000,
  });
  return { engine: () => client, asked };
}

describe("placePeople", () => {
  test("asks the engine for the place's people and passes a valid body on", async () => {
    const { engine, asked } = engineAnswering(() => Response.json(placePeople));
    const response = await proxy({ source: "example", host: "www.example-institute.test" }, engine);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(placePeople);
    expect(asked).toEqual(["/api/places/example/www.example-institute.test/people"]);
  });

  test("refuses an id the engine could not hold without asking it", async () => {
    const { engine, asked } = engineAnswering(() => Response.json(placePeople));
    const response = await proxy({ source: "Example", host: "a/b" }, engine);
    expect(response.status).toBe(400);
    expect(asked).toEqual([]);
  });

  test("a body off the contract is an engine error", async () => {
    const { engine } = engineAnswering(() => Response.json({ people: [{ email: "x" }] }));
    const response = await proxy({ source: "example", host: "www.example-institute.test" }, engine);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "engine_error" });
  });
});
