"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
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
import {
  type ReactNode,
  useState,
  useCallback,
  useEffect,
  createContext,
  use,
  useMemo,
} from "react";
import { useCollator, useFilter } from "react-aria";

import styles from "./search-dialog.module.scss";
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
  feeds: {
    id: string;
    key: string;
    displaySymbol: string;
    icon: ReactNode;
    assetClass: string;
  }[];
  publishers: ({
    id: string;
    medianScore: number;
  } & (
    | { name: string; icon: ReactNode }
    | { name?: undefined; icon?: undefined }
  ))[];
};

export const SearchDialogProvider = ({
  children,
  feeds,
  publishers,
}: Props) => {
  const searchDialogState = useSearchDialogStateContext();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResultType | "">("");
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });

  const updateSelectedType = useCallback((set: Set<ResultType | "">) => {
    setType(set.values().next().value ?? "");
  }, []);

  const close = useCallback(() => {
    searchDialogState.close();
    setTimeout(() => {
      setSearch("");
      setType("");
    }, CLOSE_DURATION_IN_MS);
  }, [searchDialogState, setSearch, setType]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        close();
      }
    },
    [close],
  );

  const results = useMemo(
    () =>
      [
        ...(type === ResultType.Publisher
          ? []
          : feeds
              .filter((feed) => filter.contains(feed.displaySymbol, search))
              .map((feed) => ({
                type: ResultType.PriceFeed as const,
                ...feed,
              }))),
        ...(type === ResultType.PriceFeed
          ? []
          : publishers
              .filter(
                (publisher) =>
                  filter.contains(publisher.id, search) ||
                  (publisher.name && filter.contains(publisher.name, search)),
              )
              .map((publisher) => ({
                type: ResultType.Publisher as const,
                ...publisher,
              }))),
      ].sort((a, b) =>
        collator.compare(
          a.type === ResultType.PriceFeed ? a.displaySymbol : (a.name ?? a.id),
          b.type === ResultType.PriceFeed ? b.displaySymbol : (b.name ?? b.id),
        ),
      ),
    [feeds, publishers, collator, filter, search, type],
  );

  return (
    <>
      <SearchDialogOpenContext value={searchDialogState}>
        {children}
      </SearchDialogOpenContext>
      <ModalDialog
        key="search-modal"
        isOpen={searchDialogState.isOpen}
        onOpenChange={handleOpenChange}
        overlayVariants={{
          unmounted: { backgroundColor: "#00000000" },
          hidden: { backgroundColor: "#00000000" },
          visible: { backgroundColor: "#00000080" },
        }}
        overlayClassName={styles.modalOverlay ?? ""}
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
        className={styles.searchMenu ?? ""}
        aria-label="Search"
      >
        <div className={styles.searchBar}>
          <div className={styles.left}>
            <SearchInput
              size="md"
              width={90}
              placeholder="Asset symbol, publisher name or id"
              value={search}
              onChange={setSearch}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <SingleToggleGroup
              selectedKeys={[type]}
              // @ts-expect-error react-aria coerces everything to Key for some reason...
              onSelectionChange={updateSelectedType}
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
              onAction={close}
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
                      : (result.name ?? result.id)
                  }
                  className={styles.item ?? ""}
                  href={`${result.type === ResultType.PriceFeed ? "/price-feeds" : "/publishers"}/${encodeURIComponent(result.id)}`}
                  data-is-first={result.id === results[0]?.id ? "" : undefined}
                >
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
                        symbol={result.displaySymbol}
                        icon={result.icon}
                        className={styles.itemTag}
                      />
                      <Badge variant="neutral" style="outline" size="xs">
                        {result.assetClass.toUpperCase()}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <PublisherTag
                        className={styles.itemTag}
                        compact
                        publisherKey={result.id}
                        {...(result.name && {
                          name: result.name,
                          icon: result.icon,
                        })}
                      />
                      <Score score={result.medianScore} />
                    </>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Virtualizer>
        </div>
      </ModalDialog>
    </>
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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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
