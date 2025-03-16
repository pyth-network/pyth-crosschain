"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import { Drawer } from "@pythnetwork/component-library/Drawer";
import { ModalDialog } from "@pythnetwork/component-library/ModalDialog";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import {
  Virtualizer,
  ListLayout,
} from "@pythnetwork/component-library/Virtualizer";
import {
  ListBox,
  ListBoxItem,
} from "@pythnetwork/component-library/unstyled/ListBox";
import { useMediaQuery } from "@react-hookz/web";
import { useRouter } from "next/navigation";
import type { ReactNode, ComponentProps } from "react";
import {
  useState,
  useCallback,
  useEffect,
  createContext,
  use,
  useMemo,
} from "react";
import { RouterProvider, useCollator, useFilter } from "react-aria";

import styles from "./search-dialog.module.scss";
import { usePriceFeeds } from "../../hooks/use-price-feeds";
import { Cluster, ClusterToName } from "../../services/pyth";
import { AssetClassTag } from "../AssetClassTag";
import { NoResults } from "../NoResults";
import { PriceFeedTag } from "../PriceFeedTag";
import { PublisherTag } from "../PublisherTag";
import { Score } from "../Score";

const CLOSE_DURATION_IN_SECONDS = 0.1;
const CLOSE_DURATION_IN_MS = CLOSE_DURATION_IN_SECONDS * 1000;

const INPUTS = new Set(["input", "select", "button", "textarea"]);

const SearchDialogOpenContext = createContext<
  ReturnType<typeof useSearchDialogStateContext> | undefined
>(undefined);

type Props = {
  children: ReactNode;
  publishers: ({
    publisherKey: string;
    averageScore: number;
    cluster: Cluster;
  } & (
    | { name: string; icon: ReactNode }
    | { name?: undefined; icon?: undefined }
  ))[];
};

export const SearchDialogProvider = ({ children, publishers }: Props) => {
  const searchDialogState = useSearchDialogStateContext();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResultType | "">("");
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const feeds = usePriceFeeds();

  const close = useCallback(
    () =>
      new Promise<void>((resolve) => {
        searchDialogState.close();
        setTimeout(() => {
          setSearch("");
          setType("");
          resolve();
        }, CLOSE_DURATION_IN_MS);
      }),
    [searchDialogState, setSearch, setType],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        close().catch(() => {
          /* no-op since this actually can't fail */
        });
      }
    },
    [close],
  );

  const router = useRouter();
  const handleOpenItem = useCallback(
    (href: string) => {
      close()
        .then(() => {
          router.push(href);
        })
        .catch(() => {
          /* no-op since this actually can't fail */
        });
    },
    [close, router],
  );

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
              .map(([symbol, { assetClass, displaySymbol }]) => ({
                type: ResultType.PriceFeed as const,
                id: symbol,
                assetClass,
                displaySymbol,
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
    <>
      <SearchDialogOpenContext value={searchDialogState}>
        {children}
      </SearchDialogOpenContext>
      <SearchContainer
        key="search-modal"
        isOpen={searchDialogState.isOpen}
        onOpenChange={handleOpenChange}
        title="Search"
      >
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
              beforeIcon={(props) => <XCircle weight="fill" {...props} />}
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
            <RouterProvider navigate={handleOpenItem}>
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
                      href={
                        result.type === ResultType.PriceFeed
                          ? `/price-feeds/${encodeURIComponent(result.id)}`
                          : `/publishers/${ClusterToName[result.cluster]}/${encodeURIComponent(result.publisherKey)}`
                      }
                      data-is-first={
                        result.id === results[0]?.id ? "" : undefined
                      }
                    >
                      <div className={styles.smallScreen}>
                        {result.type === ResultType.PriceFeed ? (
                          <PriceFeedTag
                            compact
                            symbol={result.id}
                            className={styles.itemTag}
                          />
                        ) : (
                          <PublisherTag
                            className={styles.itemTag}
                            compact
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
                                  <AssetClassTag
                                    symbol={result.id}
                                    className={styles.itemExtra ?? ""}
                                  />
                                </dd>
                              </>
                            ) : (
                              <>
                                <dt>Average Score</dt>
                                <dd>
                                  <Score
                                    score={result.averageScore}
                                    className={styles.itemExtra ?? ""}
                                  />
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
                              compact
                              symbol={result.id}
                              className={styles.itemTag}
                            />
                            <AssetClassTag
                              symbol={result.id}
                              className={styles.itemExtra ?? ""}
                            />
                          </>
                        ) : (
                          <>
                            <PublisherTag
                              className={styles.itemTag}
                              compact
                              cluster={result.cluster}
                              publisherKey={result.publisherKey}
                              {...(result.name && {
                                name: result.name,
                                icon: result.icon,
                              })}
                            />
                            <Score
                              score={result.averageScore}
                              className={styles.itemExtra ?? ""}
                            />
                          </>
                        )}
                      </div>
                    </ListBoxItem>
                  )}
                </ListBox>
              </Virtualizer>
            </RouterProvider>
          </div>
        </div>
      </SearchContainer>
    </>
  );
};

const SearchContainer = (
  props: ComponentProps<typeof Drawer> & { title: string },
) => {
  const isLarge = useMediaQuery(
    `(min-width: ${styles["breakpoint-sm"] ?? ""})`,
  );

  return isLarge ? (
    <ModalDialog
      overlayVariants={{
        unmounted: { backgroundColor: "#00000000" },
        hidden: { backgroundColor: "#00000000" },
        visible: { backgroundColor: "#00000080" },
      }}
      overlayClassName={styles.modalOverlay ?? ""}
      className={styles.searchMenu ?? ""}
      variants={{
        visible: {
          y: 0,
          transition: { type: "spring", duration: 0.8, bounce: 0.35 },
        },
        hidden: {
          y: "calc(-100% - 8rem)",
          transition: { ease: "linear", duration: CLOSE_DURATION_IN_SECONDS },
        },
        unmounted: {
          y: "calc(-100% - 8rem)",
        },
      }}
      aria-label={props.title}
      {...props}
    />
  ) : (
    <Drawer fill hideHeading {...props} />
  );
};

enum ResultType {
  PriceFeed,
  Publisher,
}

const useSearchDialogStateContext = () => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleIsOpen = useCallback(() => {
    setIsOpen((value) => !value);
  }, [setIsOpen]);
  const close = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);
  const open = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

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
        toggleIsOpen();
      }
    },
    [toggleIsOpen],
  );

  useEffect(() => {
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    isOpen,
    setIsOpen,
    toggleIsOpen,
    open,
    close,
  };
};

const useSearchDialogState = () => {
  const value = use(SearchDialogOpenContext);
  if (value) {
    return value;
  } else {
    throw new NotInitializedError();
  }
};

export const useToggleSearchDialog = () => useSearchDialogState().toggleIsOpen;

class NotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a <SearchDialogProvider>");
    this.name = "NotInitializedError";
  }
}
