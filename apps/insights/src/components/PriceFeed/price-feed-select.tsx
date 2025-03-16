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
import clsx from "clsx";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useCollator, useFilter } from "react-aria";

import styles from "./price-feed-select.module.scss";
import { usePriceFeeds } from "../../hooks/use-price-feeds";
import { Cluster } from "../../services/pyth";
import { AssetClassTag } from "../AssetClassTag";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  className: string | undefined;
  children: ReactNode;
};

export const PriceFeedSelect = ({ children, className }: Props) => {
  const feeds = usePriceFeeds();
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [search, setSearch] = useState("");
  const filteredFeeds = useMemo(
    () =>
      search === ""
        ? // This is inefficient but Safari doesn't support `Iterator.filter`, see
          // https://bugs.webkit.org/show_bug.cgi?id=248650
          [...feeds.entries()]
        : [...feeds.entries()].filter(
            ([, { displaySymbol, assetClass, key }]) =>
              filter.contains(displaySymbol, search) ||
              filter.contains(assetClass, search) ||
              filter.contains(key[Cluster.Pythnet], search),
          ),
    [feeds, search, filter],
  );
  const sortedFeeds = useMemo(
    () =>
      // eslint-disable-next-line unicorn/no-useless-spread
      [
        ...filteredFeeds.map(([symbol, { displaySymbol }]) => ({
          id: symbol,
          displaySymbol,
        })),
      ].toSorted((a, b) => collator.compare(a.displaySymbol, b.displaySymbol)),
    [filteredFeeds, collator],
  );
  return (
    <Select
      aria-label="Select a Price Feed"
      className={clsx(className, styles.priceFeedSelect)}
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
              items={sortedFeeds}
              className={styles.listbox ?? ""}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={false}
            >
              {({ id, displaySymbol }) => (
                <ListBoxItem
                  textValue={displaySymbol}
                  className={styles.priceFeed ?? ""}
                  href={`/price-feeds/${encodeURIComponent(id)}`}
                  data-is-first={id === sortedFeeds[0]?.id ? "" : undefined}
                >
                  <PriceFeedTag compact symbol={id} />
                  <AssetClassTag symbol={id} />
                </ListBoxItem>
              )}
            </ListBox>
          </Virtualizer>
        </Dialog>
      </Popover>
    </Select>
  );
};
