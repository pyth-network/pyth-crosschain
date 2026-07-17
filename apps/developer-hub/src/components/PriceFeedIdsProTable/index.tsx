"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { ColumnConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import { Callout } from "fumadocs-ui/components/callout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { SYMBOLS_API_URL } from "../../config/pyth-pro-public";
import styles from "./index.module.scss";
import { filterFeedsBySearch } from "./search";

const CHANNELS = [
  { fullName: "Real Time", id: "real_time", label: "RT" },
  { fullName: "fixed_rate@50ms", id: "fixed_rate@50ms", label: "50ms" },
  { fullName: "fixed_rate@200ms", id: "fixed_rate@200ms", label: "200ms" },
  { fullName: "fixed_rate@1000ms", id: "fixed_rate@1000ms", label: "1s" },
] as const;

const normalizeChannelId = (channelId: string) =>
  channelId === "fixed_rate@1ms" ? "real_time" : channelId;

const getSupportedChannels = (minChannel: string): string[] => {
  const normalizedMinChannel = normalizeChannelId(minChannel);
  const idx = CHANNELS.findIndex(
    (channel) => channel.id === normalizedMinChannel,
  );
  if (idx === -1) return [minChannel];
  return CHANNELS.slice(idx).map((channel) => channel.label);
};

const getChannelLabel = (channelId: string) =>
  CHANNELS.find((channel) => channel.id === normalizeChannelId(channelId))
    ?.label ?? channelId;

const ChannelSupportIndicator = ({ minChannel }: { minChannel: string }) => {
  const normalizedMinChannel = normalizeChannelId(minChannel);
  const minChannelIndex = CHANNELS.findIndex(
    (channel) => channel.id === normalizedMinChannel,
  );

  if (minChannelIndex === -1) {
    return <span className={styles.channelUnknown}>{minChannel}</span>;
  }

  const minChannelLabel = getChannelLabel(minChannel);
  const supportedChannels = getSupportedChannels(minChannel).join(", ");
  const label = `Fastest channel: ${minChannelLabel}. Supported channels: ${supportedChannels}.`;

  return (
    <div aria-label={label} className={styles.channelIndicator} role="img">
      <div aria-hidden="true" className={styles.channelTrack}>
        {CHANNELS.map((channel, index) => (
          <span
            className={[
              styles.channelSegment,
              index >= minChannelIndex ? styles.channelSegmentActive : "",
            ].join(" ")}
            key={channel.id}
          />
        ))}
      </div>
      <div aria-hidden="true" className={styles.channelLabels}>
        {CHANNELS.map((channel, index) => (
          <span
            className={[
              styles.channelLabel,
              index >= minChannelIndex ? styles.channelLabelActive : "",
            ].join(" ")}
            key={channel.id}
            title={channel.fullName}
          >
            {channel.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const LEGEND_DESCRIPTIONS: Record<(typeof CHANNELS)[number]["id"], string> = {
  "fixed_rate@50ms":
    "Minimum channel: fixed_rate@50ms. Published on fixed_rate@50ms, fixed_rate@200ms, and fixed_rate@1000ms.",
  "fixed_rate@200ms":
    "Minimum channel: fixed_rate@200ms. Published on fixed_rate@200ms and fixed_rate@1000ms.",
  "fixed_rate@1000ms":
    "Minimum channel: fixed_rate@1000ms. Published on fixed_rate@1000ms only.",
  real_time:
    "Minimum channel: Real Time. Published on Real Time, fixed_rate@50ms, fixed_rate@200ms, and fixed_rate@1000ms.",
};

export const ChannelLegend = () => (
  <div className={styles.legend}>
    <p className={styles.legendIntro}>
      The <strong>Channels</strong> column shows the fastest tier a feed
      supports. Every slower channel is also delivered, so highlighted segments
      cascade to the right.
    </p>
    <ul className={styles.legendRows}>
      {CHANNELS.map((channel) => (
        <li className={styles.legendRow} key={channel.id}>
          <ChannelSupportIndicator minChannel={channel.id} />
          <span className={styles.legendText}>
            {LEGEND_DESCRIPTIONS[channel.id]}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

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
    { id: "channels", name: "Channels" },
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
    filterFeedsBySearch,
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
      channels: <ChannelSupportIndicator minChannel={feed.min_channel} />,
      description: (
        <div className={styles.descriptionContent}>{feed.description}</div>
      ),
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
        placeholder="Search by symbol, name, ID, or hex feed ID"
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
  const result: Response = await fetch(SYMBOLS_API_URL);
  if (!result.ok) {
    throw new Error(`Failed to fetch Pyth Pro feeds: ${String(result.status)}`);
  }
  const data = pythProSchema.parse(await result.json());
  return data.toSorted(
    (firstFeed, secondFeed) =>
      firstFeed.pyth_lazer_id - secondFeed.pyth_lazer_id,
  );
};

const pythProSchema = z.array(
  z.object({
    asset_type: z.string(),
    cmc_id: z.number().int().nullable().optional(),
    description: z.string(),
    exponent: z.number(),
    hermes_id: z.string().nullable().optional(),
    min_channel: z.string(),
    name: z.string(),
    nasdaq_symbol: z.string().nullable().optional(),
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
  | "state"
  | "channels";

const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === "string") {
    return error;
  } else {
    return "An error occurred, please try again";
  }
};
