// Responses are checked against the schemas in contracts/, so the web app never carries its own
// copy of the contract. The validators are compiled from the schemas ahead of time
// (scripts/contract-validators.ts), so neither the browser nor the server compiles a schema with
// Function(). A body that fails the check is treated as no answer.
import type {
  AdminActivity,
  AdminFlagged,
  AgentReply,
  Health,
  Numbers,
  PlacePeople,
  SearchResponse,
  SourcesList,
  Story,
} from "./contract-types.generated";
import {
  isAdminActivity,
  isAdminFlagged,
  isAgentReply,
  isHealth,
  isNumbers,
  isPlacePeople,
  isSearchResponse,
  isSourcesList,
  isStory,
} from "./contract-validators.generated";

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

export function parsePlacePeople(body: unknown): PlacePeople | null {
  return isPlacePeople(body) ? body : null;
}

export function parseAdminActivity(body: unknown): AdminActivity | null {
  return isAdminActivity(body) ? body : null;
}

export function parseAdminFlagged(body: unknown): AdminFlagged | null {
  return isAdminFlagged(body) ? body : null;
}
