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
  coming_soon: "Coming Soon",
  inactive: "Inactive",
  stable: "Stable",
};

const FEED_STATE_BADGE_VARIANT: Record<
  FeedState,
  "success" | "warning" | "neutral"
> = {
  coming_soon: "warning",
  inactive: "neutral",
  stable: "success",
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
    { id: "pyth_lazer_id", isRowHeader: true, name: "Pyth Pro ID" },
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
      defaultDescending: false,
      defaultPageSize: 10,
      defaultSort: "pyth_lazer_id",
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
    data: {
      asset_type: feed.asset_type,
      description: feed.description,
      exponent: feed.exponent,
      name: feed.name,
      pyth_lazer_id: feed.pyth_lazer_id,
      state: (
        <Badge size="xs" variant={FEED_STATE_BADGE_VARIANT[feed.state]}>
          {FEED_STATE_LABELS[feed.state]}
        </Badge>
      ),
      symbol: feed.symbol,
    },
    id: feed.pyth_lazer_id,
  }));

  return (
    <>
      <SearchInput
        className={styles.searchInput ?? ""}
        label="Search price feeds"
        onChange={updateSearch}
        placeholder="Search by symbol, name, or ID (comma/space separated)"
        value={search}
      />

      {statusCounts && (
        <div
          aria-label="Filter by status"
          className={styles.statusFilters}
          role="group"
        >
          <button
            className={styles.filterButton}
            onClick={toggleAll}
            type="button"
          >
            <Badge
              size="md"
              style="outline"
              variant={allSelected ? "info" : "neutral"}
            >
              {allSelected && <Check className={styles.checkIcon} />}
              All ({statusCounts.all})
            </Badge>
          </button>
          {FEED_STATES.map((feedState) => {
            const isSelected = selectedStates.has(feedState);
            return (
              <button
                className={styles.filterButton}
                key={feedState}
                onClick={() => {
                  toggleState(feedState);
                }}
                type="button"
              >
                <Badge
                  size="md"
                  style="outline"
                  variant={
                    isSelected ? FEED_STATE_BADGE_VARIANT[feedState] : "neutral"
                  }
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
          columns={columns}
          fill
          label="Pyth Pro price feed ids"
          onSortChange={updateSortDescriptor}
          rounded
          sortDescriptor={sortDescriptor}
          stickyHeader="top"
        />
      </div>
      <Paginator
        className={styles.paginator ?? ""}
        currentPage={page}
        mkPageLink={mkPageLink}
        numPages={numPages}
        onPageChange={updatePage}
        onPageSizeChange={updatePageSize}
        pageSize={pageSize}
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
  Failed: (error: unknown) => ({ error, type: StateType.Error as const }),
  Loaded: (feeds: Awaited<ReturnType<typeof getPythProFeeds>>) => ({
    feeds,
    type: StateType.Loaded as const,
  }),
  Loading: () => ({ type: StateType.Loading as const }),
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
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
    exponent: z.number(),
    name: z.string(),
    pyth_lazer_id: z.number().int().positive(),
    state: z.enum(["stable", "coming_soon", "inactive"]),
    symbol: z.string(),
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
