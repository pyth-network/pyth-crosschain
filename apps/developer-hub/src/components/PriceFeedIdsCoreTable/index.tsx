"use client";

import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import type { ColumnConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { getPriceFeedAccountForProgram } from "@pythnetwork/pyth-solana-receiver";
import { Callout } from "fumadocs-ui/components/callout";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { z } from "zod";

import CopyAddress from "../CopyAddress";
import styles from "./index.module.scss";

export const PriceFeedIdsCoreTable = () => {
  const isLoading = useRef(false);
  const [state, setState] = useState<State>(State.NotLoaded());

  useEffect(() => {
    if (!isLoading.current) {
      setState(State.Loading());
      isLoading.current = true;
      getFeeds()
        .then((feeds) => {
          setState(State.Loaded(feeds));
        })
        .catch((error: unknown) => {
          setState(State.Failed(error));
        });
    }
  }, [isLoading]);

  switch (state.type) {
    case StateType.Loading:
    case StateType.NotLoaded: {
      return <Spinner label="Fetching price feed ids..." />;
    }
    case StateType.Error: {
      return <Callout type="error">{errorToString(state.error)}</Callout>;
    }
    case StateType.Loaded: {
      return <LoadedResults feeds={state.feeds} />;
    }
  }
};

const LoadedResults = ({
  feeds,
}: {
  feeds: Awaited<ReturnType<typeof getFeeds>>;
}) => {
  const columns: ColumnConfig<Col>[] = [
    { id: "symbol", name: "Symbol" },
    { id: "stableFeedId", name: "Stable Price Feed ID" },
    { id: "betaFeedId", name: "Beta Price Feed ID" },
    { id: "solanaPriceFeedAccount", name: "Solana Price Feed Account" },
  ];
  const [search, setSearch] = useState("");
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);
  const filteredFeeds = useMemo(
    () =>
      feeds.filter((feed) => {
        const searchLower = search.toLowerCase();
        return [
          feed.symbol,
          feed.stableFeedId,
          feed.betaFeedId,
          feed.solanaPriceFeedAccount,
        ].some((value) => value?.toLowerCase().includes(searchLower));
      }),
    [feeds, search],
  );

  return (
    <>
      <SearchInput
        label="Search price feeds"
        placeholder="Search by symbol or feed id"
        value={search}
        onChange={handleSearchChange}
        width={480}
      />
      <Table<Col>
        label="Price feed ids"
        columns={columns}
        rows={filteredFeeds.map((feed) => ({
          id: feed.symbol,
          data: {
            symbol: feed.symbol,
            stableFeedId: feed.stableFeedId ? (
              <CopyAddress maxLength={6} address={feed.stableFeedId} />
            ) : undefined,
            betaFeedId: feed.betaFeedId ? (
              <CopyAddress maxLength={6} address={feed.betaFeedId} />
            ) : undefined,
            solanaPriceFeedAccount: feed.solanaPriceFeedAccount ? (
              <CopyAddress
                maxLength={6}
                address={feed.solanaPriceFeedAccount}
              />
            ) : undefined,
          },
        }))}
        className={styles.table ?? ""}
        stickyHeader="top"
        fill
        rounded
      />
    </>
  );
};

const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === "string") {
    return error;
  } else {
    return "An error occurred, please try again";
  }
};

enum StateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

const State = {
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  Loaded: (feeds: Awaited<ReturnType<typeof getFeeds>>) => ({
    type: StateType.Loaded as const,
    feeds,
  }),
  Failed: (error: unknown) => ({ type: StateType.Error as const, error }),
};
type State = ReturnType<(typeof State)[keyof typeof State]>;

const getFeeds = async () => {
  const [pythnet, pythtest] = await Promise.all([
    getFeedsFromHermes("https://hermes.pyth.network"),
    getFeedsFromHermes("https://hermes-beta.pyth.network"),
  ]);

  const feeds = new Map<
    string,
    {
      stableFeedId?: string;
      betaFeedId?: string;
      solanaPriceFeedAccount?: string;
    }
  >();

  for (const feed of pythnet) {
    feeds.set(feed.attributes.symbol, {
      stableFeedId: `0x${feed.id}`,
      solanaPriceFeedAccount: getPriceFeedAccountForProgram(
        0,
        Buffer.from(feed.id, "hex"),
      ).toBase58(),
    });
  }
  for (const feed of pythtest) {
    feeds.set(feed.attributes.symbol, {
      ...feeds.get(feed.attributes.symbol),
      betaFeedId: `0x${feed.id}`,
    });
  }

  return [...feeds.entries()]
    .toSorted((a, b) => a[0].localeCompare(b[0]))
    .map(([symbol, attrs]) => ({ symbol, ...attrs }));
};

const getFeedsFromHermes = async (hermesUrl: string) => {
  const result = await fetch(new URL("/v2/price_feeds", hermesUrl));
  return hermesSchema.parse(await result.json());
};

const hermesSchema = z.array(
  z.object({
    id: z.string(),
    attributes: z.object({ symbol: z.string() }),
  }),
);

type Col = "symbol" | "stableFeedId" | "betaFeedId" | "solanaPriceFeedAccount";
