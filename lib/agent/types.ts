/**
 * Agent Harness — Core Types
 *
 * Shared type definitions for the autonomous agent system.
 * Covers agent identity, tool interfaces, circuit breakers,
 * decision logging, and run lifecycle.
 */

import type { ZodType, ZodObject, ZodRawShape } from "zod";

// ---------------------------------------------------------------------------
// Agent Identity
// ---------------------------------------------------------------------------

export type AgentId = "ops" | "sourcing" | "strategy";

export const AGENT_IDS: AgentId[] = ["ops", "sourcing", "strategy"];

// ---------------------------------------------------------------------------
// Tool Interfaces
// ---------------------------------------------------------------------------

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<ToolResult>;

/**
 * Internal tool definition — stores Zod schema + handler.
 * Converted to Anthropic API format by `getToolDefinitions()`.
 */
export type ToolDefinition = {
  name: string;
  description: string;
  schema: ZodObject<ZodRawShape>;
  handler: ToolHandler;
};

// ---------------------------------------------------------------------------
// Agent Configuration
// ---------------------------------------------------------------------------

export type AgentConfig = {
  agentId: AgentId;
  model: string;
  systemPrompt: string;
  toolNames: string[];
  maxTurns: number;
  defaultShadowMode: boolean;
};

// ---------------------------------------------------------------------------
// Agent Context (per-run state)
// ---------------------------------------------------------------------------

export type AgentContext = {
  correlationId: string;
  triggerType: "scheduled" | "manual" | "reactive";
  triggerDetail: string;
  startedAt: Date;
  turnCount: number;
  shadowMode: boolean;
};

// ---------------------------------------------------------------------------
// Decision Ledger
// ---------------------------------------------------------------------------

export type DecisionLedgerEntry = {
  correlationId: string;
  agentId: AgentId;
  turnNumber: number;
  toolName: string | null;
  toolArgs: Record<string, unknown> | null;
  toolResult: unknown;
  reasoning: string;
  shadowMode: boolean;
  circuitBreakerTripped: string | null;
  durationMs: number;
  triggerType: "scheduled" | "manual" | "reactive";
  triggerDetail: string;
};

// ---------------------------------------------------------------------------
// Agent Run Result
// ---------------------------------------------------------------------------

export type AgentRunResult = {
  correlationId: string;
  agentId: AgentId;
  status: "completed" | "failed" | "aborted";
  totalTurns: number;
  totalToolCalls: number;
  summary: string;
  decisions: DecisionLedgerEntry[];
  error?: string;
};

// ---------------------------------------------------------------------------
// Circuit Breaker Configuration
// ---------------------------------------------------------------------------

export type CircuitBreakerConfig = {
  /** Maximum daily CJ spending in cents. Default: $500 = 50000 */
  dailySpendingCapCents: number;
  /** Maximum lots created per day. Default: 500 */
  dailyLotCreationCap: number;
  /** Minimum profit margin percentage before tripping. Default: -5 */
  marginFloorPercent: number;
  /** Max consecutive tool failures before tripping. Default: 5 */
  maxConsecutiveFailures: number;
  /** Max CJ orders per hour. Default: 20 */
  maxCjOrdersPerHour: number;
  /** Max refunds per day. Default: 50 */
  maxRefundsPerDay: number;
};

export const DEFAULT_CIRCUIT_BREAKERS: CircuitBreakerConfig = {
  dailySpendingCapCents: 50000,
  dailyLotCreationCap: 500,
  marginFloorPercent: -5,
  maxConsecutiveFailures: 5,
  maxCjOrdersPerHour: 20,
  maxRefundsPerDay: 50,
};

// ---------------------------------------------------------------------------
// Zod-to-JSON-Schema converter
// ---------------------------------------------------------------------------

/**
 * Convert a Zod schema to a JSON Schema object compatible with Anthropic's API.
 *
 * Handles: ZodObject, ZodString, ZodNumber, ZodBoolean, ZodEnum, ZodOptional,
 * ZodDefault, ZodArray, ZodRecord, ZodUnion, ZodLiteral, ZodNullable.
 */
export function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  return convertZodType(schema);
}

function convertZodType(schema: ZodType): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodObject": {
      const shape = (schema as ZodObject<ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convertZodType(value as ZodType);
        // Check if the field is required (not optional, not default)
        const fieldDef = (value as unknown as { _def: Record<string, unknown> })
          ._def;
        const fieldTypeName = fieldDef.typeName as string;
        if (fieldTypeName !== "ZodOptional" && fieldTypeName !== "ZodDefault") {
          required.push(key);
        }
      }

      const result: Record<string, unknown> = {
        type: "object",
        properties,
      };
      if (required.length > 0) {
        result.required = required;
      }
      // Anthropic requires additionalProperties: false for strict mode
      result.additionalProperties = false;
      return result;
    }

    case "ZodString": {
      const result: Record<string, unknown> = { type: "string" };
      if (def.description) result.description = def.description;
      return result;
    }

    case "ZodNumber": {
      const result: Record<string, unknown> = { type: "number" };
      if (def.description) result.description = def.description;
      return result;
    }

    case "ZodBoolean": {
      const result: Record<string, unknown> = { type: "boolean" };
      if (def.description) result.description = def.description;
      return result;
    }

    case "ZodEnum": {
      return {
        type: "string",
        enum: def.values as string[],
      };
    }

    case "ZodOptional": {
      return convertZodType(def.innerType as ZodType);
    }

    case "ZodDefault": {
      return convertZodType(def.innerType as ZodType);
    }

    case "ZodArray": {
      return {
        type: "array",
        items: convertZodType(def.type as ZodType),
      };
    }

    case "ZodRecord": {
      return {
        type: "object",
        additionalProperties: convertZodType(def.valueType as ZodType),
      };
    }

    case "ZodNullable": {
      const inner = convertZodType(def.innerType as ZodType);
      return { ...inner, nullable: true };
    }

    case "ZodLiteral": {
      return { type: typeof def.value, const: def.value };
    }

    case "ZodUnion": {
      const options = (def.options as ZodType[]).map(convertZodType);
      return { anyOf: options };
    }

    default: {
      // Fallback for unknown types
      return { type: "string" };
    }
  }
}
