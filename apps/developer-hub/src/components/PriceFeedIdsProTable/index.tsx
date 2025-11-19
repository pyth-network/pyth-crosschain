"use client";

import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { ColumnConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import { Callout } from "fumadocs-ui/components/callout";
import { matchSorter } from "match-sorter";
import { useEffect, useState } from "react";
import { z } from "zod";

import styles from "./index.module.scss";

export const PriceFeedIdsProTable = () => {
  const [state, setState] = useState<State>(State.NotLoaded());
  useEffect(() => {
    setState(State.Loading());
    getPythProFeeds()
      .then((feeds) => {
        setState(State.Loaded(feeds));
      })
      .catch((error: unknown) => {
        setState(State.Failed(error));
      });
  }, []);

  const columns: ColumnConfig<Col>[] = [
    { id: "asset_type", name: "Asset Type" },
    { id: "description", name: "Description" },
    { id: "name", name: "Name" },
    { id: "symbol", name: "Symbol" },
    { id: "pyth_lazer_id", name: "Pyth Pro ID", isRowHeader: true },
    { id: "exponent", name: "Exponent" },
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
    (a, b, { column, direction }) => {
      if (column === "pyth_lazer_id") {
        return direction === "ascending"
          ? a.pyth_lazer_id - b.pyth_lazer_id
          : b.pyth_lazer_id - a.pyth_lazer_id;
      }
      return 0;
    },
    (items, searchString) => {
      if (!searchString) {
        return items;
      }
      return matchSorter(items, searchString, {
        keys: ["pyth_lazer_id", "symbol", "name", "description"],
      });
    },
    {
      defaultSort: "pyth_lazer_id",
      defaultPageSize: 10,
      defaultDescending: false,
    },
  );

  if (state.type === StateType.Error) {
    return <Callout type="error">{errorToString(state.error)}</Callout>;
  }

  const isLoading =
    state.type === StateType.Loading || state.type === StateType.NotLoaded;

  const rows = paginatedItems.map((feed) => ({
    id: feed.pyth_lazer_id,
    data: {
      asset_type: feed.asset_type,
      description: feed.description,
      name: feed.name,
      symbol: feed.symbol,
      pyth_lazer_id: feed.pyth_lazer_id,
      exponent: feed.exponent,
    },
  }));

  return (
    <>
      <SearchInput
        label="Search price feeds"
        placeholder="Search by symbol, name, or Pyth Pro ID"
        value={search}
        onChange={updateSearch}
        className={styles.searchInput ?? ""}
      />

      <Table<Col>
        {...(isLoading ? { isLoading: true } : { isLoading: false, rows })}
        label="Pyth Pro price feed ids"
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

enum StateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

const State = {
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  Loaded: (feeds: Awaited<ReturnType<typeof getPythProFeeds>>) => ({
    type: StateType.Loaded as const,
    feeds,
  }),
  Failed: (error: unknown) => ({ type: StateType.Error as const, error }),
};
type State = ReturnType<(typeof State)[keyof typeof State]>;

const getPythProFeeds = async () => {
  const result: Response = await fetch(
    "https://history.pyth-lazer.dourolabs.app/history/v1/symbols",
  );
  const data = pythProSchema.parse(await result.json());
  return data.toSorted(
    (firstFeed, secondFeed) =>
      firstFeed.pyth_lazer_id - secondFeed.pyth_lazer_id,
  );
};

const pythProSchema = z.array(
  z.object({
    asset_type: z.string(),
    description: z.string(),
    name: z.string(),
    symbol: z.string(),
    pyth_lazer_id: z.number().int().positive(),
    exponent: z.number(),
  }),
);

type Col =
  | "asset_type"
  | "description"
  | "name"
  | "symbol"
  | "pyth_lazer_id"
  | "exponent";

const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === "string") {
    return error;
  } else {
    return "An error occurred, please try again";
  }
};
