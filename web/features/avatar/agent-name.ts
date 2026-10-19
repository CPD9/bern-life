// The player's first agent is the Navigator, called Lumi unless the player renames it. The field
// may be empty while someone types; wherever the name is shown, a blank one reads as Lumi.

export const defaultAgentName = "Lumi";
export const agentNameMaxLength = 24;

export function parseAgentName(value: unknown): string | null {
  return typeof value === "string" ? value.slice(0, agentNameMaxLength) : null;
}

export function shownAgentName(name: string): string {
  return name.trim() || defaultAgentName;
}
