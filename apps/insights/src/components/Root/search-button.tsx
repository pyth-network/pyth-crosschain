"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import { Badge } from "@pythnetwork/component-library/Badge";
import type { Props as ButtonProps } from "@pythnetwork/component-library/Button";
import { Button } from "@pythnetwork/component-library/Button";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { SearchButton as SearchButtonComponent } from "@pythnetwork/component-library/SearchButton";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import type { Button as UnstyledButton } from "@pythnetwork/component-library/unstyled/Button";
import type { ListBoxItemProps } from "@pythnetwork/component-library/unstyled/ListBox";
import {
  ListBox,
  ListBoxItem,
} from "@pythnetwork/component-library/unstyled/ListBox";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import {
  ListLayout,
  Virtualizer,
} from "@pythnetwork/component-library/Virtualizer";
import { matchSorter } from "match-sorter";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cluster } from "../../services/pyth";
import { ClusterToName } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { PublisherTag } from "../PublisherTag";
import { Score } from "../Score";
import styles from "./search-button.module.scss";

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
    priceAccount: string;
    icon: ReactNode;
  }[];
  publishers: ({
    publisherKey: string;
    averageScore?: number | undefined;
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
) => <SearchButtonComponent size="sm" {...props} />;

const useSearchDrawer = ({ feeds, publishers }: ResolvedSearchButtonProps) => {
  const drawer = useDrawer();

  const searchDrawer = useMemo(
    () => ({
      contents: <SearchDialogContents feeds={feeds} publishers={publishers} />,
      fill: true,
      hideHeading: true,
      title: "Search",
      variant: "dialog" as const,
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

type SearchDialogContentsProps = ResolvedSearchButtonProps;

const SearchDialogContents = ({
  feeds,
  publishers,
}: SearchDialogContentsProps) => {
  /** hooks */
  const drawer = useDrawer();
  const logger = useLogger();

  /** refs */
  const closeDrawerDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const openTabModifierActiveRef = useRef(false);
  const middleMousePressedRef = useRef(false);

  /** state */
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResultType | "">("");

  /** callbacks */
  const closeDrawer = useCallback(() => {
    if (closeDrawerDebounceRef.current) {
      clearTimeout(closeDrawerDebounceRef.current);
      closeDrawerDebounceRef.current = undefined;
    }

    // we debounce the drawer closure because, if we don't,
    // mobile browsers (at least on iOS) may squash the native <a />
    // click, resulting in no price feed loading for the user
    closeDrawerDebounceRef.current = setTimeout(() => {
      drawer.close().catch((error: unknown) => {
        logger.error(error);
      });
    }, 250);
  }, [drawer, logger]);
  const onLinkPointerDown = useCallback<
    NonNullable<ListBoxItemProps<never>["onPointerDown"]>
  >((e) => {
    const { button, ctrlKey, metaKey } = e;

    middleMousePressedRef.current = button === 1;

    // on press is too abstracted and doesn't give us the native event
    // for determining if the user clicked their middle mouse button,
    // so we need to use the native onClick directly
    middleMousePressedRef.current = button === 1;
    openTabModifierActiveRef.current = metaKey || ctrlKey;
  }, []);
  const onLinkPointerUp = useCallback<
    NonNullable<ListBoxItemProps<never>["onPointerUp"]>
  >(() => {
    const userWantsNewTab =
      middleMousePressedRef.current || openTabModifierActiveRef.current;

    // // they want a new tab, the search popover stays open
    if (!userWantsNewTab) closeDrawer();

    middleMousePressedRef.current = false;
    openTabModifierActiveRef.current = false;
  }, [closeDrawer]);

  /** memos */
  const results = useMemo(() => {
    const filteredFeeds = matchSorter(feeds, search, {
      keys: ["displaySymbol", "symbol", "description", "priceAccount"],
    }).map(({ symbol, ...feed }) => ({
      id: symbol,
      symbol,
      type: ResultType.PriceFeed as const,
      ...feed,
    }));

    const filteredPublishers = matchSorter(publishers, search, {
      keys: ["publisherKey", "name"],
    }).map((publisher) => ({
      id: [ClusterToName[publisher.cluster], publisher.publisherKey].join(":"),
      type: ResultType.Publisher as const,
      ...publisher,
    }));

    if (type === ResultType.PriceFeed) {
      return filteredFeeds;
    }
    if (type === ResultType.Publisher) {
      return filteredPublishers;
    }
    return [...filteredFeeds, ...filteredPublishers];
  }, [feeds, publishers, search, type]);

  return (
    <div className={styles.searchDialogContents}>
      <div className={styles.searchBar}>
        <div className={styles.left}>
          <SearchInput
            autoFocus
            className={styles.searchInput ?? ""}
            onChange={setSearch}
            placeholder="Asset symbol, publisher name or id"
            size="md"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            value={search}
          />
          <SingleToggleGroup
            className={styles.typeFilter ?? ""}
            items={[
              { children: "All", id: "" },
              { children: "Price Feeds", id: ResultType.PriceFeed },
              { children: "Publishers", id: ResultType.Publisher },
            ]}
            // @ts-expect-error react-aria coerces everything to Key for some reason...
            onSelectionChange={setType}
            selectedKey={type}
          />
        </div>
        <Button
          beforeIcon={<XCircle weight="fill" />}
          className={styles.closeButton ?? ""}
          hideText
          rounded
          size="sm"
          slot="close"
          variant="ghost"
        >
          Close
        </Button>
      </div>
      <div className={styles.body}>
        <Virtualizer layout={new ListLayout()}>
          <ListBox
            aria-label="Search"
            autoFocus={false}
            className={styles.listbox ?? ""}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            items={results}
            renderEmptyState={() => (
              <NoResults
                onClearSearch={() => {
                  setSearch("");
                }}
                query={search}
              />
            )}
            shouldFocusOnHover
          >
            {(result) => (
              <ListBoxItem
                className={styles.item ?? ""}
                data-is-first={result.id === results[0]?.id ? "" : undefined}
                href={
                  result.type === ResultType.PriceFeed
                    ? `/price-feeds/${encodeURIComponent(result.symbol)}`
                    : `/publishers/${ClusterToName[result.cluster]}/${encodeURIComponent(result.publisherKey)}`
                }
                onPointerDown={onLinkPointerDown}
                onPointerUp={onLinkPointerUp}
                textValue={
                  result.type === ResultType.PriceFeed
                    ? result.displaySymbol
                    : (result.name ?? result.publisherKey)
                }
              >
                <div className={styles.smallScreen}>
                  {result.type === ResultType.PriceFeed ? (
                    <SymbolPairTag
                      className={styles.itemTag}
                      description={result.description}
                      displaySymbol={result.displaySymbol}
                      icon={result.icon}
                    />
                  ) : (
                    <PublisherTag
                      className={styles.itemTag}
                      cluster={result.cluster}
                      publisherKey={result.publisherKey}
                      {...(result.name && {
                        icon: result.icon,
                        name: result.name,
                      })}
                    />
                  )}
                  <dl className={styles.bottom}>
                    <div className={styles.field}>
                      <dt>Type</dt>
                      <dd>
                        <Badge
                          size="xs"
                          style="filled"
                          variant={
                            result.type === ResultType.PriceFeed
                              ? "warning"
                              : "info"
                          }
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
                            {result.averageScore !== undefined && (
                              <Score score={result.averageScore} />
                            )}
                          </dd>
                        </>
                      )}
                    </div>
                  </dl>
                </div>
                <div className={styles.largeScreen}>
                  <div className={styles.itemType}>
                    <Badge
                      size="xs"
                      style="filled"
                      variant={
                        result.type === ResultType.PriceFeed
                          ? "warning"
                          : "info"
                      }
                    >
                      {result.type === ResultType.PriceFeed
                        ? "PRICE FEED"
                        : "PUBLISHER"}
                    </Badge>
                  </div>
                  {result.type === ResultType.PriceFeed ? (
                    <>
                      <SymbolPairTag
                        className={styles.itemTag}
                        description={result.description}
                        displaySymbol={result.displaySymbol}
                        icon={result.icon}
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
                          icon: result.icon,
                          name: result.name,
                        })}
                      />
                      {result.averageScore !== undefined && (
                        <Score score={result.averageScore} />
                      )}
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
