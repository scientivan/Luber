/**
 * @lp-guardian/core — shared types & constants for the LP Guardian (Sui) monorepo.
 *
 * This is the single source of truth for the data schema frozen on Day 0
 * (see brief §7 INTERFACE CONTRACTS / §8). MCP server, BE Agent, BE Data
 * client typings, and the web app all import from here so the contract
 * cannot drift between surfaces.
 */
export * from "./types.js";
export * from "./intents.js";
