import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HistoryClient } from "../clients/history.js";
import { ASSET_TYPES } from "../constants.js";

export function registerAllResources(
  server: McpServer,
  historyClient: HistoryClient,
): void {
  // Static resource: full feed catalog
  server.registerResource(
    "feeds",
    "pyth://feeds",
    {
      description:
        "Full catalog of all Pyth Pro price feeds across all asset classes.",
      mimeType: "application/json",
    },
    async (uri) => {
      const { data: feeds } = await historyClient.getSymbols();
      return {
        contents: [
          {
            text: JSON.stringify(feeds),
            uri: uri.href,
          },
        ],
      };
    },
  );

  // Template resource: feeds filtered by asset_type
  server.registerResource(
    "feeds-by-asset-type",
    new ResourceTemplate("pyth://feeds/{asset_type}", {
      list: async () => ({
        resources: ASSET_TYPES.map((t) => ({
          description: `Pyth Pro ${t} price feeds`,
          name: `${t} feeds`,
          uri: `pyth://feeds/${t}`,
        })),
      }),
    }),
    {
      description:
        "Pyth Pro price feeds filtered by asset type (crypto, fx, equity, metal, rates, commodity, funding-rate).",
      mimeType: "application/json",
    },
    async (uri, { asset_type }) => {
      const { data: feeds } = await historyClient.getSymbols(
        undefined,
        asset_type as string,
      );
      return {
        contents: [
          {
            text: JSON.stringify(feeds),
            uri: uri.href,
          },
        ],
      };
    },
  );
}
