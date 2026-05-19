"use client";

import { PythHttpClient } from "@pythnetwork/client";
import { Connection, PublicKey } from "@solana/web3.js";
import type { ComponentProps } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { z } from "zod";

const PYTHNET_RPC_URL = "https://api2.pythnet.pyth.network";
const PYTHNET_WS_URL = "wss://api2.pythnet.pyth.network";
const PROGRAM_KEY = new PublicKey(
  "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH",
);

export enum PriceFeedListContextType {
  NotInitialized,
  Loading,
  Loaded,
  Error,
}

const NotInitialized = () => ({
  type: PriceFeedListContextType.NotInitialized as const,
});
const Loading = () => ({ type: PriceFeedListContextType.Loading as const });
const Loaded = (priceFeedList: PriceFeed[]) => ({
  priceFeedList,
  type: PriceFeedListContextType.Loaded as const,
});
const ErrorState = (error: unknown) => ({
  error,
  type: PriceFeedListContextType.Error as const,
});

export type PriceFeedListContext =
  | ReturnType<typeof NotInitialized>
  | ReturnType<typeof Loading>
  | ReturnType<typeof Loaded>
  | ReturnType<typeof ErrorState>;

const PriceFeedListContext = createContext<PriceFeedListContext>(
  NotInitialized(),
);

export const PriceFeedListProvider = (
  props: Omit<ComponentProps<typeof PriceFeedListContext.Provider>, "value">,
) => {
  const [state, setState] = useState<PriceFeedListContext>(NotInitialized());

  useEffect(() => {
    setState(Loading());
    const abortController = new AbortController();
    loadPriceFeedList(abortController.signal)
      .then((result) => {
        setState(Loaded(result));
      })
      .catch((error: unknown) => {
        setState(ErrorState(error));
      });
    return () => {
      abortController.abort();
    };
  }, []);

  return <PriceFeedListContext.Provider value={state} {...props} />;
};

export const usePriceFeedList = () => useContext(PriceFeedListContext);

const loadPriceFeedList = async (signal: AbortSignal) => {
  const pythClient = new PythHttpClient(
    new Connection(PYTHNET_RPC_URL, {
      commitment: "confirmed",
      fetch: (url, init) => fetch(url, { signal, ...init }),
      wsEndpoint: PYTHNET_WS_URL,
    }),
    PROGRAM_KEY,
  );
  const onChainData = await onChainDataSchema.parseAsync(
    await pythClient.getData(),
  );
  return onChainData.products.map((product) => ({
    description: product.description,
    feedId: product.price_account,
    name: product.symbol,
  }));
};

const onChainDataSchema = z.object({
  products: z.array(
    z.object({
      description: z.string(),
      price_account: z.string(),
      symbol: z.string(),
    }),
  ),
});

export type PriceFeed = {
  name: string;
  description: string;
  feedId: string;
};
