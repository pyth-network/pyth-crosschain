"use client";

import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Switch } from "@pythnetwork/component-library/Switch";
import type { ColumnConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { Callout } from "fumadocs-ui/components/callout";
import { matchSorter } from "match-sorter";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  dailyRollupFileSchema,
  type ChangeEntry,
  type ChangeType,
  type DailyRollupFile,
  type FieldDiff,
} from "../../data/pro-price-feed-changelog/types";
import styles from "./index.module.scss";

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const ROLLUP_DATA_URL = "/data/pro-price-feed-changelog/daily-rollups.json";

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  went_live: "Went Live",
  added: "Added",
  changed: "Changed",
  removed: "Removed",
};

const CHANGE_TYPE_VARIANTS: Record<
  ChangeType,
  "success" | "info" | "warning" | "error"
> = {
  went_live: "success",
  added: "info",
  changed: "warning",
  removed: "error",
};

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

enum StateType {
  NotLoaded = "NotLoaded",
  Loading = "Loading",
  Loaded = "Loaded",
  Error = "Error",
}

const State = {
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  Loaded: (data: DailyRollupFile) => ({
    type: StateType.Loaded as const,
    data,
  }),
  Failed: (error: unknown) => ({ type: StateType.Error as const, error }),
};
type State = ReturnType<(typeof State)[keyof typeof State]>;

type Col =
  | "symbol"
  | "pythLazerId"
  | "changeType"
  | "status"
  | "changedFields";

const columns: ColumnConfig<Col>[] = [
  { id: "symbol", name: "Symbol", isRowHeader: true },
  { id: "pythLazerId", name: "Pyth Pro ID" },
  { id: "changeType", name: "Change" },
  { id: "status", name: "Status" },
  { id: "changedFields", name: "Changed Fields" },
];

export const PriceFeedIdsProChangelog = () => {
  const searchParams = useSearchParams();

  const [state, setState] = useState<State>(State.NotLoaded());
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [includeAllFieldDiffs, setIncludeAllFieldDiffs] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [pageByDay, setPageByDay] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setState(State.Loading());
    fetch(ROLLUP_DATA_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = dailyRollupFileSchema.parse(await response.json());
        setState(State.Loaded(data));
        if (data.days[0]) {
          setExpandedDay(data.days[0].date);
        }
      })
      .catch((error: unknown) => {
        setState(State.Failed(error));
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (debouncedSearch) {
      url.searchParams.set("q", debouncedSearch);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  }, [debouncedSearch]);

  const filteredDays = useMemo(() => {
    if (state.type !== StateType.Loaded) return [];

    return state.data.days.map((day) => {
      let visibleChanges = day.changes.filter((change) => {
        if (
          !includeAllFieldDiffs &&
          change.changeType !== "went_live" &&
          change.changeType !== "added" &&
          change.changeType !== "removed" &&
          change.statusBefore === change.statusAfter
        ) {
          return false;
        }
        return true;
      });

      if (debouncedSearch) {
        visibleChanges = matchSorter(visibleChanges, debouncedSearch, {
          keys: ["symbol", "name", (item) => String(item.pythLazerId)],
        });
      }

      return { ...day, visibleChanges };
    });
  }, [state, includeAllFieldDiffs, debouncedSearch]);

  const hasRollupHistory =
    state.type === StateType.Loaded && state.data.days.length > 0;
  const hasAnyVisibleData = filteredDays.some(
    (d) => d.visibleChanges.length > 0,
  );

  return (
    <div className={styles.wrapper}>
      {state.type === StateType.Loaded && (
        <div className={styles.controls}>
          <SearchInput
            label="Search changelog entries"
            placeholder="Search by symbol, name, or ID"
            value={search}
            onChange={setSearch}
          />
          <Switch
            isSelected={includeAllFieldDiffs}
            onChange={setIncludeAllFieldDiffs}
            className={styles.switch ?? ""}
          >
            Include all property changes
          </Switch>
        </div>
      )}

      {(state.type === StateType.NotLoaded ||
        state.type === StateType.Loading) && (
        <Table<Col>
          label="Pyth Pro Price Feed ID Changelog"
          columns={columns}
          rows={[]}
          isLoading
          rounded
          fill
        />
      )}

      {state.type === StateType.Error && (
        <Callout type="error">
          Failed to load changelog data: {errorToString(state.error)}
        </Callout>
      )}

      {state.type === StateType.Loaded && !hasRollupHistory && (
        <NoResults
          icon={<Info />}
          header="No changelog entries yet"
          body={
            <p>
              The first snapshot has been recorded. Daily changelog entries will
              appear after the next UTC snapshot comparison.
            </p>
          }
          variant="info"
        />
      )}

      {state.type === StateType.Loaded &&
        hasRollupHistory &&
        !hasAnyVisibleData && (
          <NoResults
            query={search}
            onClearSearch={() => {
              setSearch("");
            }}
          />
        )}

      {state.type === StateType.Loaded &&
        hasRollupHistory &&
        hasAnyVisibleData && (
          <div className={styles.dayList}>
            {filteredDays.map((day) => {
              if (day.visibleChanges.length === 0) return null;

              const isExpanded = expandedDay === day.date;
              const page = pageByDay[day.date] ?? 1;
              const numPages = Math.max(
                1,
                Math.ceil(day.visibleChanges.length / pageSize),
              );
              const safePage = Math.min(page, numPages);
              const offset = (safePage - 1) * pageSize;
              const pagedChanges = day.visibleChanges.slice(
                offset,
                offset + pageSize,
              );

              const rows = pagedChanges.map((change) => ({
                id: `${day.date}-${change.pythLazerId}-${change.changeType}`,
                data: {
                  symbol: change.symbol,
                  pythLazerId: change.pythLazerId,
                  changeType: (
                    <Badge
                      variant={CHANGE_TYPE_VARIANTS[change.changeType]}
                      size="xs"
                    >
                      {CHANGE_TYPE_LABELS[change.changeType]}
                    </Badge>
                  ),
                  status: formatStatus(change),
                  changedFields: summarizeChangedFields(change.changedFields),
                },
              }));

              return (
                <Card
                  key={day.date}
                  nonInteractive
                  title={formatDayLabel(day.date)}
                  variant="secondary"
                  className={styles.dayCard}
                  toolbar={
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setExpandedDay((previous) =>
                          previous === day.date ? null : day.date,
                        );
                      }}
                      afterIcon={isExpanded ? <CaretUp /> : <CaretDown />}
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </Button>
                  }
                >
                  <div className={styles.badges}>
                    <Badge variant="success" style="outline" size="xs">
                      Went Live: {day.totals.went_live}
                    </Badge>
                    <Badge variant="info" style="outline" size="xs">
                      Added: {day.totals.added}
                    </Badge>
                    <Badge variant="warning" style="outline" size="xs">
                      Changed: {day.totals.changed}
                    </Badge>
                    <Badge variant="error" style="outline" size="xs">
                      Removed: {day.totals.removed}
                    </Badge>
                    <Badge variant="neutral" style="outline" size="xs">
                      Visible: {day.visibleChanges.length}
                    </Badge>
                  </div>

                  {isExpanded && (
                    <div className={styles.details}>
                      <Table<Col>
                        label={`Pyth Pro changelog for ${formatDayLabel(day.date)}`}
                        columns={columns}
                        rows={rows}
                        rounded
                        fill
                      />
                      <Paginator
                        numPages={numPages}
                        currentPage={safePage}
                        onPageChange={(nextPage: number) => {
                          setPageByDay((previous) => ({
                            ...previous,
                            [day.date]: nextPage,
                          }));
                        }}
                        pageSize={pageSize}
                        onPageSizeChange={(nextSize: number) => {
                          setPageByDay({});
                          setPageSize(nextSize);
                        }}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
};

const formatDayLabel = (day: string) => {
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return `${day} (UTC)`;
  return `${dayFormatter.format(parsed)} (UTC)`;
};

const formatStatus = (change: ChangeEntry) => {
  if (change.statusBefore === change.statusAfter)
    return change.statusAfter ?? "-";
  return `${change.statusBefore ?? "-"} -> ${change.statusAfter ?? "-"}`;
};

const summarizeChangedFields = (changedFields: FieldDiff[]) => {
  if (changedFields.length === 0) return "-";
  const topFields = changedFields.slice(0, 3).map((field) => field.path);
  if (changedFields.length <= 3) return topFields.join(", ");
  return `${topFields.join(", ")}, +${String(changedFields.length - 3)} more`;
};

const errorToString = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An error occurred, please try again";
};
