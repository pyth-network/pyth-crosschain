"use client";

import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { ColumnConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import { getPriceFeedAccountForProgram } from "@pythnetwork/pyth-solana-receiver";
import { Callout } from "fumadocs-ui/components/callout";
import { matchSorter } from "match-sorter";
import { useEffect, useState } from "react";
import { z } from "zod";

import CopyAddress from "../CopyAddress";
import styles from "./index.module.scss";

export const PriceFeedIdsCoreTable = () => {
  const [state, setState] = useState<State>(State.NotLoaded());
  useEffect(() => {
    setState(State.Loading());
    getFeeds()
      .then((feeds) => {
        setState(State.Loaded(feeds));
      })
      .catch((error: unknown) => {
        setState(State.Failed(error));
      });
  }, []);

  const columns: ColumnConfig<Col>[] = [
    { id: "symbol", name: "Symbol", isRowHeader: true },
    { id: "stableFeedId", name: "Stable Price Feed ID" },
    { id: "betaFeedId", name: "Beta Price Feed ID" },
    { id: "solanaPriceFeedAccount", name: "Solana Price Feed Account" },
  ];

  const {
    search,
    sortDescriptor,
    page,
    pageSize,
    updateSearch,
    updateSortDescriptor,
    updatePage,
    updatePageSize,
    paginatedItems,
    numPages,
    mkPageLink,
  } = useQueryParamFilterPagination(
    state.type === StateType.Loaded ? state.feeds : [],
    () => true,
    () => 1,
    (items, searchString) => {
      return matchSorter(items, searchString, {
        keys: [
          "symbol",
          "stableFeedId",
          "betaFeedId",
          "solanaPriceFeedAccount",
        ],
      });
    },
    { defaultSort: "symbol", defaultPageSize: 10 },
  );

  if (state.type === StateType.Error) {
    return <Callout type="error">{errorToString(state.error)}</Callout>;
  }

  const isLoading =
    state.type === StateType.Loading || state.type === StateType.NotLoaded;

  const rows = paginatedItems.map((feed) => ({
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
        <CopyAddress maxLength={6} address={feed.solanaPriceFeedAccount} />
      ) : undefined,
    },
  }));

  return (
    <>
      <SearchInput
        label="Search price feeds"
        placeholder="Search by symbol or feed id"
        value={search}
        onChange={updateSearch}
        className={styles.searchInput ?? ""}
      />

      <Table<Col>
        {...(isLoading ? { isLoading: true } : { isLoading: false, rows })}
        label="Price feed ids"
        columns={columns}
        onSortChange={updateSortDescriptor}
        sortDescriptor={sortDescriptor}
        stickyHeader="top"
        fill
        rounded
      />
      <Paginator
        numPages={numPages}
        currentPage={page}
        onPageChange={updatePage}
        pageSize={pageSize}
        onPageSizeChange={updatePageSize}
        mkPageLink={mkPageLink}
        className={styles.paginator ?? ""}
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
