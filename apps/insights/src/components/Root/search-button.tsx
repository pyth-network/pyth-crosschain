"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import { Badge } from "@pythnetwork/component-library/Badge";
import type { Props as ButtonProps } from "@pythnetwork/component-library/Button";
import { Button } from "@pythnetwork/component-library/Button";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import {
  Virtualizer,
  ListLayout,
} from "@pythnetwork/component-library/Virtualizer";
import type { Button as UnstyledButton } from "@pythnetwork/component-library/unstyled/Button";
import {
  ListBox,
  ListBoxItem,
} from "@pythnetwork/component-library/unstyled/ListBox";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import type { ReactNode } from "react";
import { useMemo, useCallback, useEffect, useState } from "react";
import { useIsSSR, useCollator, useFilter } from "react-aria";

import styles from "./search-button.module.scss";
import { Cluster, ClusterToName } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { PriceFeedTag } from "../PriceFeedTag";
import { PublisherTag } from "../PublisherTag";
import { Score } from "../Score";

const INPUTS = new Set(["input", "select", "button", "textarea"]);

type Props =
  | { isLoading: true }
  | (ResolvedSearchButtonProps & { isLoading?: false | undefined });

export const SearchButton = (props: Props) =>
  props.isLoading ? (
    <SearchButtonImpl isPending />
  ) : (
    <ResolvedSearchButton {...props} />
  );

type ResolvedSearchButtonProps = {
  feeds: {
    symbol: string;
    displaySymbol: string;
    assetClass: string;
    description: string;
    icon: ReactNode;
  }[];
  publishers: ({
    publisherKey: string;
    averageScore: number;
    cluster: Cluster;
  } & (
    | { name: string; icon: ReactNode }
    | { name?: undefined; icon?: undefined }
  ))[];
};

const ResolvedSearchButton = (props: ResolvedSearchButtonProps) => {
  const openSearchDrawer = useSearchDrawer(props);

  useSearchHotkey(openSearchDrawer);

  return <SearchButtonImpl onPress={openSearchDrawer} />;
};

const SearchButtonImpl = (
  props: Omit<ButtonProps<typeof UnstyledButton>, "children">,
) => (
  <div className={styles.searchButton}>
    <Button
      className={styles.largeScreenSearchButton ?? ""}
      variant="outline"
      beforeIcon={<MagnifyingGlass />}
      size="sm"
      rounded
      {...props}
    >
      <SearchShortcutText />
    </Button>
    <Button
      className={styles.smallScreenSearchButton ?? ""}
      hideText
      variant="ghost"
      beforeIcon={<MagnifyingGlass />}
      size="sm"
      rounded
      {...props}
    >
      Search
    </Button>
  </div>
);

const useSearchDrawer = ({ feeds, publishers }: ResolvedSearchButtonProps) => {
  const drawer = useDrawer();

  const searchDrawer = useMemo(
    () => ({
      fill: true,
      hideHeading: true,
      title: "Search",
      variant: "dialog" as const,
      contents: <SearchDialogContents feeds={feeds} publishers={publishers} />,
    }),
    [feeds, publishers],
  );

  const openSearchDrawer = useCallback(() => {
    drawer.open(searchDrawer);
  }, [drawer, searchDrawer]);

  return openSearchDrawer;
};

const useSearchHotkey = (openSearchDrawer: () => void) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName.toLowerCase();
      const isEditing =
        !tagName ||
        INPUTS.has(tagName) ||
        (activeElement !== null &&
          "isContentEditable" in activeElement &&
          activeElement.isContentEditable);
      const isSlash = event.key === "/";
      // Meta key for mac, ctrl key for non-mac
      const isCtrlK = event.key === "k" && (event.metaKey || event.ctrlKey);

      if (!isEditing && (isSlash || isCtrlK)) {
        event.preventDefault();
        openSearchDrawer();
      }
    },
    [openSearchDrawer],
  );

  useEffect(() => {
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};

const SearchShortcutText = () => {
  const isSSR = useIsSSR();
  return isSSR ? <Skeleton width={7} /> : <SearchTextImpl />;
};

const SearchTextImpl = () => {
  const isMac = useMemo(() => navigator.userAgent.includes("Mac"), []);
  return isMac ? "⌘ K" : "Ctrl K";
};

type SearchDialogContentsProps = ResolvedSearchButtonProps;

const SearchDialogContents = ({
  feeds,
  publishers,
}: SearchDialogContentsProps) => {
  const drawer = useDrawer();
  const logger = useLogger();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResultType | "">("");
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const closeDrawer = useCallback(() => {
    drawer.close().catch((error: unknown) => {
      logger.error(error);
    });
  }, [drawer, logger]);
  const results = useMemo(
    () =>
      [
        ...(type === ResultType.Publisher
          ? []
          : // This is inefficient but Safari doesn't support `Iterator.filter`,
            // see https://bugs.webkit.org/show_bug.cgi?id=248650
            [...feeds.entries()]
              .filter(([, { displaySymbol }]) =>
                filter.contains(displaySymbol, search),
              )
              .map(([symbol, feed]) => ({
                type: ResultType.PriceFeed as const,
                id: symbol,
                ...feed,
              }))),
        ...(type === ResultType.PriceFeed
          ? []
          : publishers
              .filter(
                (publisher) =>
                  filter.contains(publisher.publisherKey, search) ||
                  (publisher.name && filter.contains(publisher.name, search)),
              )
              .map((publisher) => ({
                type: ResultType.Publisher as const,
                id: [
                  ClusterToName[publisher.cluster],
                  publisher.publisherKey,
                ].join(":"),
                ...publisher,
              }))),
      ].sort((a, b) =>
        collator.compare(
          a.type === ResultType.PriceFeed
            ? a.displaySymbol
            : (a.name ?? a.publisherKey),
          b.type === ResultType.PriceFeed
            ? b.displaySymbol
            : (b.name ?? b.publisherKey),
        ),
      ),
    [feeds, publishers, collator, filter, search, type],
  );

  return (
    <div className={styles.searchDialogContents}>
      <div className={styles.searchBar}>
        <div className={styles.left}>
          <SearchInput
            size="md"
            placeholder="Asset symbol, publisher name or id"
            value={search}
            onChange={setSearch}
            className={styles.searchInput ?? ""}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <SingleToggleGroup
            selectedKey={type}
            className={styles.typeFilter ?? ""}
            // @ts-expect-error react-aria coerces everything to Key for some reason...
            onSelectionChange={setType}
            items={[
              { id: "", children: "All" },
              { id: ResultType.PriceFeed, children: "Price Feeds" },
              { id: ResultType.Publisher, children: "Publishers" },
            ]}
          />
        </div>
        <Button
          className={styles.closeButton ?? ""}
          beforeIcon={<XCircle weight="fill" />}
          slot="close"
          hideText
          rounded
          variant="ghost"
          size="sm"
        >
          Close
        </Button>
      </div>
      <div className={styles.body}>
        <Virtualizer layout={new ListLayout()}>
          <ListBox
            aria-label="Search"
            items={results}
            className={styles.listbox ?? ""}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={false}
            // @ts-expect-error looks like react-aria isn't exposing this
            // property in the typescript types correctly...
            shouldFocusOnHover
            emptyState={
              <NoResults
                query={search}
                onClearSearch={() => {
                  setSearch("");
                }}
              />
            }
          >
            {(result) => (
              <ListBoxItem
                textValue={
                  result.type === ResultType.PriceFeed
                    ? result.displaySymbol
                    : (result.name ?? result.publisherKey)
                }
                className={styles.item ?? ""}
                onAction={closeDrawer}
                href={
                  result.type === ResultType.PriceFeed
                    ? `/price-feeds/${encodeURIComponent(result.symbol)}`
                    : `/publishers/${ClusterToName[result.cluster]}/${encodeURIComponent(result.publisherKey)}`
                }
                data-is-first={result.id === results[0]?.id ? "" : undefined}
              >
                <div className={styles.smallScreen}>
                  {result.type === ResultType.PriceFeed ? (
                    <PriceFeedTag
                      className={styles.itemTag}
                      displaySymbol={result.displaySymbol}
                      description={result.description}
                      icon={result.icon}
                    />
                  ) : (
                    <PublisherTag
                      className={styles.itemTag}
                      cluster={result.cluster}
                      publisherKey={result.publisherKey}
                      {...(result.name && {
                        name: result.name,
                        icon: result.icon,
                      })}
                    />
                  )}
                  <dl className={styles.bottom}>
                    <div className={styles.field}>
                      <dt>Type</dt>
                      <dd>
                        <Badge
                          variant={
                            result.type === ResultType.PriceFeed
                              ? "warning"
                              : "info"
                          }
                          style="filled"
                          size="xs"
                        >
                          {result.type === ResultType.PriceFeed
                            ? "PRICE FEED"
                            : "PUBLISHER"}
                        </Badge>
                      </dd>
                    </div>
                    <div className={styles.field}>
                      {result.type === ResultType.PriceFeed ? (
                        <>
                          <dt>Asset Class</dt>
                          <dd>
                            <AssetClassBadge>
                              {result.assetClass}
                            </AssetClassBadge>
                          </dd>
                        </>
                      ) : (
                        <>
                          <dt>Average Score</dt>
                          <dd>
                            <Score score={result.averageScore} />
                          </dd>
                        </>
                      )}
                    </div>
                  </dl>
                </div>
                <div className={styles.largeScreen}>
                  <div className={styles.itemType}>
                    <Badge
                      variant={
                        result.type === ResultType.PriceFeed
                          ? "warning"
                          : "info"
                      }
                      style="filled"
                      size="xs"
                    >
                      {result.type === ResultType.PriceFeed
                        ? "PRICE FEED"
                        : "PUBLISHER"}
                    </Badge>
                  </div>
                  {result.type === ResultType.PriceFeed ? (
                    <>
                      <PriceFeedTag
                        displaySymbol={result.displaySymbol}
                        description={result.description}
                        icon={result.icon}
                        className={styles.itemTag}
                      />
                      <AssetClassBadge>{result.assetClass}</AssetClassBadge>
                    </>
                  ) : (
                    <>
                      <PublisherTag
                        className={styles.itemTag}
                        cluster={result.cluster}
                        publisherKey={result.publisherKey}
                        {...(result.name && {
                          name: result.name,
                          icon: result.icon,
                        })}
                      />
                      <Score score={result.averageScore} />
                    </>
                  )}
                </div>
              </ListBoxItem>
            )}
          </ListBox>
        </Virtualizer>
      </div>
    </div>
  );
};

enum ResultType {
  PriceFeed,
  Publisher,
}
