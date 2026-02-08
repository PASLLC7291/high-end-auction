/**
 * MCP Barrel — Combines all tool servers and provides schema conversion.
 */

import type { ToolDefinition } from "../types";
import { zodToJsonSchema } from "../types";
import { pipelineTools } from "./pipeline-server";
import { supplierTools } from "./supplier-server";
import { platformTools } from "./platform-server";

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

const ALL_TOOLS: ToolDefinition[] = [
  ...pipelineTools,
  ...supplierTools,
  ...platformTools,
];

/**
 * Get all available tools.
 */
export function getAllTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

/**
 * Get a subset of tools by name.
 */
export function getToolsByNames(names: string[]): ToolDefinition[] {
  const nameSet = new Set(names);
  return ALL_TOOLS.filter((t) => nameSet.has(t.name));
}

// ---------------------------------------------------------------------------
// Anthropic API Schema Conversion
// ---------------------------------------------------------------------------

/**
 * Convert internal tool definitions to Anthropic SDK's `Tool[]` format.
 */
export function getToolDefinitions(
  tools: ToolDefinition[]
): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: zodToJsonSchema(tool.schema),
  }));
}
