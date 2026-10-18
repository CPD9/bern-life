import { describe, expect, test } from "bun:test";
import { InvalidEnvError, MissingEnvError, parseDataDir, parseEnv } from "./env";

describe("parseEnv", () => {
  test("fixtures mode needs no engine URL", () => {
    expect(parseEnv({ DEMO_FIXTURES: "1" })).toEqual({ engineUrl: null, demoFixtures: true });
  });

  test("engine mode reads the engine URL", () => {
    const parsed = parseEnv({ ENGINE_URL: "http://127.0.0.1:8100" });
    expect(parsed.demoFixtures).toBe(false);
    expect(parsed.engineUrl?.href).toBe("http://127.0.0.1:8100/");
  });

  test("fixtures mode keeps an engine URL when one is given", () => {
    const parsed = parseEnv({ DEMO_FIXTURES: "1", ENGINE_URL: "http://127.0.0.1:8102" });
    expect(parsed.engineUrl?.href).toBe("http://127.0.0.1:8102/");
  });

  test("engine mode without a URL fails with the variable name", () => {
    expect(() => parseEnv({ DEMO_FIXTURES: "0" })).toThrow(new MissingEnvError("ENGINE_URL"));
    expect(() => parseEnv({ ENGINE_URL: "" })).toThrow(new MissingEnvError("ENGINE_URL"));
  });

  test("a URL that does not parse or is not http(s) is rejected", () => {
    expect(() => parseEnv({ ENGINE_URL: "127.0.0.1:8100" })).toThrow(
      new InvalidEnvError("ENGINE_URL"),
    );
    expect(() => parseEnv({ ENGINE_URL: "file:///etc/hosts" })).toThrow(
      new InvalidEnvError("ENGINE_URL"),
    );
  });

  test("DEMO_FIXTURES accepts only 1 or 0", () => {
    expect(() => parseEnv({ DEMO_FIXTURES: "true" })).toThrow(new InvalidEnvError("DEMO_FIXTURES"));
  });
});

describe("parseDataDir", () => {
  test("defaults to the repo's data folder and resolves relative values from web/", () => {
    expect(parseDataDir({}, "/repo/web")).toBe("/repo/data");
    expect(parseDataDir({ BERNLIFE_DATA_DIR: "" }, "/repo/web")).toBe("/repo/data");
    expect(parseDataDir({ BERNLIFE_DATA_DIR: "../shared" }, "/repo/web")).toBe("/repo/shared");
    expect(parseDataDir({ BERNLIFE_DATA_DIR: "/srv/bernlife" }, "/repo/web")).toBe("/srv/bernlife");
  });
});
