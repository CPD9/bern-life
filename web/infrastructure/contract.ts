// Responses are checked against the schemas in contracts/, compiled at load time, so the web app
// never carries its own copy of the contract. A body that fails the check is treated as no answer.
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import agentSchema from "../../contracts/agent.schema.json";
import healthSchema from "../../contracts/health.schema.json";
import numbersSchema from "../../contracts/numbers.schema.json";
import profileSchema from "../../contracts/profile.schema.json";
import questSchema from "../../contracts/quest.schema.json";
import resultSchema from "../../contracts/result.schema.json";
import sourcesSchema from "../../contracts/sources.schema.json";
import type {
  AgentReply,
  Health,
  Numbers,
  SearchResponse,
  SourcesList,
  Story,
} from "./contract-types.generated";

const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(profileSchema);

// The agent schema refers to the result schema, so the result schema is compiled first.
const isSearchResponse = ajv.compile<SearchResponse>(resultSchema);
const isHealth = ajv.compile<Health>(healthSchema);
const isStory = ajv.compile<Story>(questSchema);
const isAgentReply = ajv.compile<AgentReply>(agentSchema);
const isSourcesList = ajv.compile<SourcesList>(sourcesSchema);
const isNumbers = ajv.compile<Numbers>(numbersSchema);

export function parseSearchResponse(body: unknown): SearchResponse | null {
  return isSearchResponse(body) ? body : null;
}

export function parseHealth(body: unknown): Health | null {
  return isHealth(body) ? body : null;
}

export function parseStory(body: unknown): Story | null {
  return isStory(body) ? body : null;
}

/**
 * Each profile the results show, by id, with the names it is shown under: a result's own profile
 * and the related profile a result is shown through.
 */
function shownProfiles(results: AgentReply["results"]): Map<string, Set<string>> {
  const shown = new Map<string, Set<string>>();
  const show = (id: string, name: string) => shown.set(id, (shown.get(id) ?? new Set()).add(name));
  for (const { profile, via } of results.flatMap((response) => response.results)) {
    show(profile.id, profile.name.value);
    if (via !== undefined) show(via.related_profile_id, via.related_name);
  }
  return shown;
}

// A schema cannot say that mentions and actions point into the reply's own results, so it is
// checked here: a name the results do not show, under that name, never reaches the screen.
function pointsIntoResults({ mentions, actions, results }: AgentReply): boolean {
  const shown = shownProfiles(results);
  return (
    mentions.every((mention) => shown.get(mention.profile_id)?.has(mention.name) === true) &&
    actions.every((action) =>
      action.type === "open_profile"
        ? shown.has(action.profile_id)
        : action.result < results.length,
    )
  );
}

export function parseAgentReply(body: unknown): AgentReply | null {
  return isAgentReply(body) && pointsIntoResults(body) ? body : null;
}

export function parseSourcesList(body: unknown): SourcesList | null {
  return isSourcesList(body) ? body : null;
}

export function parseNumbers(body: unknown): Numbers | null {
  return isNumbers(body) ? body : null;
}
