/**
 * Agent Registry — Maps agent IDs to their configurations.
 */

import type { AgentConfig, AgentId } from "../types";
import { AGENT_IDS } from "../types";
import { opsAgentConfig } from "./ops-agent";
import { sourcingAgentConfig } from "./sourcing-agent";
import { strategyAgentConfig } from "./strategy-agent";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  ops: opsAgentConfig,
  sourcing: sourcingAgentConfig,
  strategy: strategyAgentConfig,
};

/**
 * Get the agent configuration for a given agent ID.
 */
export function getAgentConfig(agentId: AgentId): AgentConfig {
  const config = AGENT_CONFIGS[agentId];
  if (!config) {
    throw new Error(`Unknown agent ID: ${agentId}`);
  }
  return config;
}

/**
 * List all available agent IDs.
 */
export function listAgents(): AgentId[] {
  return [...AGENT_IDS];
}
