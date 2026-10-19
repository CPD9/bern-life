// The body of POST /api/agent, checked before anything reaches the engine (contracts/api.md). The
// size limit applies to the raw body as sent, so the route reads it with `readJsonBody`.
import type { AgentMessage, AgentRequest } from "./engine-types";

export const maxAgentBodyBytes = 16 * 1024;
const maxAgentMessages = 12;

const roles: readonly AgentMessage["role"][] = ["user", "assistant"];

function isRole(value: unknown): value is AgentMessage["role"] {
  return roles.some((role) => role === value);
}

function parseMessage(value: unknown): AgentMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const { role, content } = value as Record<string, unknown>;
  return isRole(role) && typeof content === "string" ? { role, content } : null;
}

export function parseAgentRequest(body: unknown): AgentRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { messages } = body as Record<string, unknown>;
  if (!Array.isArray(messages)) return null;
  if (messages.length === 0 || messages.length > maxAgentMessages) return null;
  const parsed: AgentMessage[] = [];
  for (const value of messages) {
    const message = parseMessage(value);
    if (message === null) return null;
    parsed.push(message);
  }
  return parsed.at(-1)?.role === "user" ? { messages: parsed } : null;
}
