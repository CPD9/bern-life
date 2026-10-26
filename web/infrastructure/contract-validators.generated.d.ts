// Generated from contracts/*.schema.json by `bun run contract:validators`. Do not edit.
import type { AdminActivity, AdminFlagged, AgentReply, Health, Numbers, PlacePeople, SearchResponse, SourcesList, Story } from "./contract-types.generated";

export declare const isSearchResponse: (data: unknown) => data is SearchResponse;
export declare const isHealth: (data: unknown) => data is Health;
export declare const isStory: (data: unknown) => data is Story;
export declare const isAgentReply: (data: unknown) => data is AgentReply;
export declare const isSourcesList: (data: unknown) => data is SourcesList;
export declare const isNumbers: (data: unknown) => data is Numbers;
export declare const isPlacePeople: (data: unknown) => data is PlacePeople;
export declare const isAdminActivity: (data: unknown) => data is AdminActivity;
export declare const isAdminFlagged: (data: unknown) => data is AdminFlagged;
