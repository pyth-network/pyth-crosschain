"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { ColumnConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import { Callout } from "fumadocs-ui/components/callout";
import { matchSorter } from "match-sorter";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import styles from "./index.module.scss";

const FEED_STATES = ["stable", "coming_soon", "inactive"] as const;
type FeedState = (typeof FEED_STATES)[number];

const FEED_STATE_LABELS: Record<FeedState, string> = {
  stable: "Stable",
  coming_soon: "Coming Soon",
  inactive: "Inactive",
};

const FEED_STATE_BADGE_VARIANT: Record<
  FeedState,
  "success" | "warning" | "neutral"
> = {
  stable: "success",
  coming_soon: "warning",
  inactive: "neutral",
};

export const PriceFeedIdsProTable = () => {
  const [state, setState] = useState<State>(State.NotLoaded());
  const [selectedStates, setSelectedStates] = useState<Set<FeedState>>(
    new Set(FEED_STATES),
  );

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

  const statusCounts = useMemo(() => {
    if (state.type !== StateType.Loaded) return;
    const counts: Record<string, number> = { all: state.feeds.length };
    for (const s of FEED_STATES) counts[s] = 0;
    for (const f of state.feeds) counts[f.state] = (counts[f.state] ?? 0) + 1;
    return counts;
  }, [state]);

  const filteredByStatus = useMemo(() => {
    if (state.type !== StateType.Loaded) return [];
    if (selectedStates.size === FEED_STATES.length) return state.feeds;
    return state.feeds.filter((feed) => selectedStates.has(feed.state));
  }, [state, selectedStates]);

  const columns: ColumnConfig<Col>[] = [
    { id: "asset_type", name: "Asset Type" },
    { id: "description", name: "Description" },
    { id: "name", name: "Name" },
    { id: "symbol", name: "Symbol" },
    { id: "pyth_lazer_id", name: "Pyth Pro ID", isRowHeader: true },
    { id: "exponent", name: "Exponent" },
    { id: "state", name: "Status" },
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
    filteredByStatus,
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
      // Split by commas or spaces to support multiple search terms
      const searchTerms = searchString
        .split(/[,\s]+/)
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length > 0);

      if (searchTerms.length === 0) {
        return items;
      }

      // For single term, use matchSorter directly for better ranking
      const firstTerm = searchTerms[0];
      if (searchTerms.length === 1 && firstTerm !== undefined) {
        return matchSorter(items, firstTerm, {
          keys: ["pyth_lazer_id", "symbol", "name", "description"],
        });
      }

      // For multiple terms, use exact/substring matching with OR logic
      // This ensures each term finds its specific matches
      const termMatchesItem = (
        item: (typeof items)[number],
        term: string,
      ): boolean => {
        // Numeric ID match - exact match for numeric terms
        if (/^\d+$/.test(term)) {
          return String(item.pyth_lazer_id) === term;
        }

        // String match - case-insensitive substring match
        const symbol = item.symbol.toLowerCase();
        const name = item.name.toLowerCase();
        const description = item.description.toLowerCase();

        return (
          symbol.includes(term) ||
          name.includes(term) ||
          description.includes(term)
        );
      };

      // Collect matches with priority: exact ID matches first, then others
      const exactIdMatches: (typeof items)[number][] = [];
      const otherMatches = new Map<number, (typeof items)[number]>();

      for (const term of searchTerms) {
        const isNumericTerm = /^\d+$/.test(term);
        for (const item of items) {
          if (termMatchesItem(item, term)) {
            // Exact ID matches get priority
            if (isNumericTerm && String(item.pyth_lazer_id) === term) {
              if (
                !exactIdMatches.some(
                  (m) => m.pyth_lazer_id === item.pyth_lazer_id,
                )
              ) {
                exactIdMatches.push(item);
              }
            } else if (
              !exactIdMatches.some(
                (m) => m.pyth_lazer_id === item.pyth_lazer_id,
              )
            ) {
              otherMatches.set(item.pyth_lazer_id, item);
            }
          }
        }
      }

      // Return exact ID matches first, then other matches sorted by ID
      const otherMatchesArray = [...otherMatches.values()].sort(
        (a, b) => a.pyth_lazer_id - b.pyth_lazer_id,
      );
      return [...exactIdMatches, ...otherMatchesArray];
    },
    {
      defaultSort: "pyth_lazer_id",
      defaultPageSize: 10,
      defaultDescending: false,
    },
  );

  const toggleState = useCallback(
    (feedState: FeedState) => {
      setSelectedStates((prev) => {
        const next = new Set(prev);
        if (next.has(feedState)) {
          next.delete(feedState);
        } else {
          next.add(feedState);
        }
        // If the set would become empty, keep just the clicked item
        if (next.size === 0) {
          return new Set([feedState]);
        }
        return next;
      });
      updatePage(1);
    },
    [updatePage],
  );

  const toggleAll = useCallback(() => {
    setSelectedStates((prev) => {
      if (prev.size === FEED_STATES.length) {
        // All selected → select only "stable" as default
        return new Set<FeedState>(["stable"]);
      }
      return new Set(FEED_STATES);
    });
    updatePage(1);
  }, [updatePage]);

  if (state.type === StateType.Error) {
    return <Callout type="error">{errorToString(state.error)}</Callout>;
  }

  const isLoading =
    state.type === StateType.Loading || state.type === StateType.NotLoaded;

  const allSelected = selectedStates.size === FEED_STATES.length;

  const rows = paginatedItems.map((feed) => ({
    id: feed.pyth_lazer_id,
    data: {
      asset_type: feed.asset_type,
      description: feed.description,
      name: feed.name,
      symbol: feed.symbol,
      pyth_lazer_id: feed.pyth_lazer_id,
      exponent: feed.exponent,
      state: (
        <Badge variant={FEED_STATE_BADGE_VARIANT[feed.state]} size="xs">
          {FEED_STATE_LABELS[feed.state]}
        </Badge>
      ),
    },
  }));

  return (
    <>
      <SearchInput
        label="Search price feeds"
        placeholder="Search by symbol, name, or ID (comma/space separated)"
        value={search}
        onChange={updateSearch}
        className={styles.searchInput ?? ""}
      />

      {statusCounts && (
        <div
          className={styles.statusFilters}
          role="group"
          aria-label="Filter by status"
        >
          <button
            type="button"
            className={styles.filterButton}
            onClick={toggleAll}
          >
            <Badge
              variant={allSelected ? "info" : "neutral"}
              style="outline"
              size="md"
            >
              {allSelected && <Check className={styles.checkIcon} />}
              All ({statusCounts.all})
            </Badge>
          </button>
          {FEED_STATES.map((feedState) => {
            const isSelected = selectedStates.has(feedState);
            return (
              <button
                key={feedState}
                type="button"
                className={styles.filterButton}
                onClick={() => {
                  toggleState(feedState);
                }}
              >
                <Badge
                  variant={
                    isSelected ? FEED_STATE_BADGE_VARIANT[feedState] : "neutral"
                  }
                  style="outline"
                  size="md"
                >
                  {isSelected && <Check className={styles.checkIcon} />}
                  {FEED_STATE_LABELS[feedState]} ({statusCounts[feedState]})
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.tableWrapper}>
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
      </div>
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
    state: z.enum(["stable", "coming_soon", "inactive"]),
  }),
);

type Col =
  | "asset_type"
  | "description"
  | "name"
  | "symbol"
  | "pyth_lazer_id"
  | "exponent"
  | "state";

const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === "string") {
    return error;
  } else {
    return "An error occurred, please try again";
  }
};
