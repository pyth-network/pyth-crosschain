/**
 * Pyth Network MCP Server Implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { TOOL_DEFINITIONS, handleToolCall } from './tools/index.js';
import { RESOURCE_DEFINITIONS, handleReadResource } from './resources/index.js';
import { PROMPT_DEFINITIONS, handleGetPrompt } from './prompts/index.js';
import { wrapError, isPythError } from './types/errors.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'pyth-network',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // =========================================================================
  // Tool Handlers
  // =========================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, (args as Record<string, unknown>) ?? {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const pythError = isPythError(error) ? error : wrapError(error);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(pythError.toJSON(), null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // =========================================================================
  // Resource Handlers
  // =========================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: RESOURCE_DEFINITIONS,
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const { uri } = request.params;

    try {
      const content = await handleReadResource(uri);

      // Determine mime type from resource definition
      const resource = RESOURCE_DEFINITIONS.find(r => r.uri === uri);
      const mimeType = resource?.mimeType ?? 'text/plain';

      return {
        contents: [
          {
            uri,
            mimeType,
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // =========================================================================
  // Prompt Handlers
  // =========================================================================

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: PROMPT_DEFINITIONS,
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async request => {
    const { name, arguments: args } = request.params;

    try {
      return handleGetPrompt(name, args);
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to get prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  return server;
}

/**
 * Run the server with stdio transport
 */
export async function runServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
