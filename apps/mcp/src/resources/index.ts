import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HistoryClient } from "../clients/history.js";
import { ASSET_TYPES } from "../constants.js";
import { isActive } from "../utils/feeds.js";

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
        "Catalog of Pyth Pro price feeds across all asset classes (retired 'inactive' feeds excluded).",
      mimeType: "application/json",
    },
    async (uri) => {
      const { data: allFeeds } = await historyClient.getSymbols();
      const feeds = allFeeds.filter(isActive);
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
        "Pyth Pro price feeds filtered by asset type (retired 'inactive' feeds excluded).",
      mimeType: "application/json",
    },
    async (uri, { asset_type }) => {
      const { data: allFeeds } = await historyClient.getSymbols();
      const feeds = allFeeds.filter(
        (f) => isActive(f) && f.asset_type === asset_type,
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
