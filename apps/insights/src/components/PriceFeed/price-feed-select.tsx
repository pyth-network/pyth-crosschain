"use client";

import { DropdownCaretDown } from "@pythnetwork/component-library/DropdownCaretDown";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import {
  ListLayout,
  Virtualizer,
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
import { matchSorter } from "match-sorter";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { AssetClassBadge } from "../AssetClassBadge";
import styles from "./price-feed-select.module.scss";

type Props = {
  className: string | undefined;
  children: ReactNode;
} & (
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      feeds: {
        symbol: string;
        displaySymbol: string;
        assetClass: string;
        key: string;
        description: string;
        icon: ReactNode;
      }[];
    }
);

export const PriceFeedSelect = (props: Props) =>
  props.isLoading ? (
    <PriceFeedSelectImpl {...props} />
  ) : (
    <ResolvedPriceFeedSelect {...props} />
  );

type ResolvedPriceFeedSelect = {
  className: string | undefined;
  children: ReactNode;
  feeds: {
    symbol: string;
    displaySymbol: string;
    assetClass: string;
    key: string; // price_account
    description: string;
    icon: ReactNode;
  }[];
};

const ResolvedPriceFeedSelect = ({
  feeds,
  ...props
}: ResolvedPriceFeedSelect) => {
  const [search, setSearch] = useState("");
  const filteredAndSortedFeeds = useMemo(
    () =>
      matchSorter(feeds, search, {
        keys: ["displaySymbol", "symbol", "description", "key"],
      }),
    [feeds, search],
  );
  return (
    <PriceFeedSelectImpl
      menu={
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
                items={filteredAndSortedFeeds}
                className={styles.listbox ?? ""}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={false}
              >
                {({ symbol, displaySymbol, description, icon, assetClass }) => (
                  <ListBoxItem
                    textValue={displaySymbol}
                    className={styles.priceFeed ?? ""}
                    href={`/price-feeds/${encodeURIComponent(symbol)}`}
                    data-is-first={
                      symbol === filteredAndSortedFeeds[0]?.symbol
                        ? ""
                        : undefined
                    }
                    prefetch={false}
                  >
                    <SymbolPairTag
                      displaySymbol={displaySymbol}
                      description={description}
                      icon={icon}
                    />
                    <AssetClassBadge>{assetClass}</AssetClassBadge>
                  </ListBoxItem>
                )}
              </ListBox>
            </Virtualizer>
          </Dialog>
        </Popover>
      }
      {...props}
    />
  );
};

type PriceFeedSelectImplProps = {
  className: string | undefined;
  children: ReactNode;
} & (
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      menu: ReactNode;
    }
);

const PriceFeedSelectImpl = ({
  children,
  className,
  ...props
}: PriceFeedSelectImplProps) => (
  <Select
    aria-label="Select a Price Feed"
    className={clsx(className, styles.priceFeedSelect)}
  >
    <Button
      className={styles.trigger ?? ""}
      isPending={props.isLoading ?? false}
    >
      {children}
      <DropdownCaretDown className={styles.caret} />
    </Button>
    {!props.isLoading && props.menu}
  </Select>
);
