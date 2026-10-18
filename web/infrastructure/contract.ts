// Responses are checked against the schemas in contracts/, compiled at load time, so the web app
// never carries its own copy of the contract. A body that fails the check is treated as no answer.
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import healthSchema from "../../contracts/health.schema.json";
import profileSchema from "../../contracts/profile.schema.json";
import questSchema from "../../contracts/quest.schema.json";
import resultSchema from "../../contracts/result.schema.json";
import type { Health, SearchResponse, Story } from "./contract-types.generated";

const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(profileSchema);

const isSearchResponse = ajv.compile<SearchResponse>(resultSchema);
const isHealth = ajv.compile<Health>(healthSchema);
const isStory = ajv.compile<Story>(questSchema);

export function parseSearchResponse(body: unknown): SearchResponse | null {
  return isSearchResponse(body) ? body : null;
}

export function parseHealth(body: unknown): Health | null {
  return isHealth(body) ? body : null;
}

export function parseStory(body: unknown): Story | null {
  return isStory(body) ? body : null;
}
