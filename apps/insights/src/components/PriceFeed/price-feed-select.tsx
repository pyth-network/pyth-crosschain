"use client";

import { DropdownCaretDown } from "@pythnetwork/component-library/DropdownCaretDown";
import {
  Virtualizer,
  ListLayout,
} from "@pythnetwork/component-library/Virtualizer";
import { Button } from "@pythnetwork/component-library/unstyled/Button";
import { Dialog } from "@pythnetwork/component-library/unstyled/Dialog";
import {
  ListBox,
  ListBoxItem,
} from "@pythnetwork/component-library/unstyled/ListBox";
import { Popover } from "@pythnetwork/component-library/unstyled/Popover";
import { SearchField } from "@pythnetwork/component-library/unstyled/SearchField";
import { Select } from "@pythnetwork/component-library/unstyled/Select";
import { Input } from "@pythnetwork/component-library/unstyled/TextField";
import { type ReactNode, useMemo, useState } from "react";
import { useCollator, useFilter } from "react-aria";

import styles from "./price-feed-select.module.scss";

type Props = {
  children: ReactNode;
  feeds: {
    id: string;
    key: string;
    displaySymbol: string;
    name: ReactNode;
    assetClass: ReactNode;
    assetClassText: string;
  }[];
};

export const PriceFeedSelect = ({ children, feeds }: Props) => {
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [search, setSearch] = useState("");
  const sortedFeeds = useMemo(
    () =>
      feeds.sort((a, b) => collator.compare(a.displaySymbol, b.displaySymbol)),
    [feeds, collator],
  );
  const filteredFeeds = useMemo(
    () =>
      search === ""
        ? sortedFeeds
        : sortedFeeds.filter(
            (feed) =>
              filter.contains(feed.displaySymbol, search) ||
              filter.contains(feed.assetClassText, search) ||
              filter.contains(feed.key, search),
          ),
    [sortedFeeds, search, filter],
  );
  return (
    <Select
      aria-label="Select a Price Feed"
      className={styles.priceFeedSelect ?? ""}
    >
      <Button className={styles.trigger ?? ""}>
        {children}
        <DropdownCaretDown className={styles.caret} />
      </Button>
      <Popover placement="bottom start" className={styles.popover ?? ""}>
        <Dialog aria-label="Price Feeds" className={styles.dialog ?? ""}>
          <SearchField
            value={search}
            onChange={setSearch}
            className={styles.searchField ?? ""}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            aria-label="Search"
          >
            <Input
              className={styles.searchInput ?? ""}
              placeholder="Symbol, asset class, or key"
            />
          </SearchField>
          <Virtualizer layout={new ListLayout()}>
            <ListBox
              items={filteredFeeds}
              className={styles.listbox ?? ""}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={false}
            >
              {({ name, assetClass, id, displaySymbol }) => (
                <ListBoxItem
                  textValue={displaySymbol}
                  className={styles.priceFeed ?? ""}
                  href={`/price-feeds/${id}`}
                  data-is-first={id === filteredFeeds[0]?.id ? "" : undefined}
                >
                  {name}
                  {assetClass}
                </ListBoxItem>
              )}
            </ListBox>
          </Virtualizer>
        </Dialog>
      </Popover>
    </Select>
  );
};
