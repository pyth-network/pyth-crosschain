import { useEffect, useState } from "react";
import { z } from "zod";

import { SYMBOLS_API_URL } from "../types";

const priceFeedSchema = z.object({
  pyth_lazer_id: z.number().int().positive(),
  name: z.string(),
  symbol: z.string(),
  description: z.string(),
  asset_type: z.string(),
  exponent: z.number(),
});

const priceFeedsSchema = z.array(priceFeedSchema);

export type PriceFeedData = {
  id: number;
  name: string;
  symbol: string;
  description: string;
  assetType: string;
};

type UsePriceFeedsState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "loaded"; feeds: PriceFeedData[] };

export function usePriceFeeds(): UsePriceFeedsState {
  const [state, setState] = useState<UsePriceFeedsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    const fetchFeeds = async () => {
      try {
        const response = await fetch(SYMBOLS_API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch price feeds: ${String(response.status)}`,
          );
        }

        const data: unknown = await response.json();
        const parsed = priceFeedsSchema.parse(data);

        const feeds: PriceFeedData[] = parsed
          .map((feed) => ({
            id: feed.pyth_lazer_id,
            name: feed.name,
            symbol: feed.symbol,
            description: feed.description,
            assetType: feed.asset_type,
          }))
          .sort((first, second) => first.id - second.id);

        setState({ status: "loaded", feeds });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to load price feeds",
        });
      }
    };

    fetchFeeds().catch(() => {
      // Error already handled in fetchFeeds
    });

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
