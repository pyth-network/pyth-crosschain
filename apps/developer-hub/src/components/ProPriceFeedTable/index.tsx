"use client";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { Input } from "@pythnetwork/component-library/unstyled/TextField";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PRICE_FEEDS_PRO_COLUMNS } from "./constants";
import { fetchPriceFeedsProPriceIdMetadata } from "./fetcher";
import styles from "./index.module.scss";

// type imported from fetcher

enum PriceFeedsProPriceIdStateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

const PriceFeedsProPriceIdState = {
  NotLoaded: () => ({ type: PriceFeedsProPriceIdStateType.NotLoaded as const }),
  Loading: () => ({ type: PriceFeedsProPriceIdStateType.Loading as const }),
  Loaded: (
    priceFeeds: Awaited<ReturnType<typeof fetchPriceFeedsProPriceIdMetadata>>,
  ) => ({
    type: PriceFeedsProPriceIdStateType.Loaded as const,
    priceFeeds,
  }),
  Failed: (error: unknown) => ({
    type: PriceFeedsProPriceIdStateType.Error as const,
    error,
  }),
};

type PriceFeedsProPriceIdState = ReturnType<
  (typeof PriceFeedsProPriceIdState)[keyof typeof PriceFeedsProPriceIdState]
>;

const usePriceFeedsProPriceIdState = () => {
  const [state, setState] = useState<PriceFeedsProPriceIdState>(
    PriceFeedsProPriceIdState.NotLoaded(),
  );

  useEffect(() => {
    setState(PriceFeedsProPriceIdState.Loading());
    fetchPriceFeedsProPriceIdMetadata()
      .then((priceFeeds) => {
        setState(PriceFeedsProPriceIdState.Loaded(priceFeeds));
      })
      .catch((error: unknown) => {
        const normalizedError = new Error(
          error instanceof Error
            ? error.message
            : "Failed to load price feeds pro IDs",
        );
        setState(PriceFeedsProPriceIdState.Failed(normalizedError));
      });
  }, []);

  return state;
};

type Col =
  | "assetType"
  | "description"
  | "name"
  | "symbol"
  | "proId"
  | "exponent";

const LoadedPriceFeedsProPriceIdTable = ({
  priceFeeds,
}: {
  priceFeeds: Awaited<ReturnType<typeof fetchPriceFeedsProPriceIdMetadata>>;
}) => {
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");

  const updateSearch = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchRaw(event.target.value);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchRaw.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [searchRaw]);

  const filteredFeeds = useMemo(() => {
    return priceFeeds.filter((feed) => {
      const searchLower = search.toLowerCase();
      return (
        feed.symbol.toLowerCase().includes(searchLower) ||
        feed.name.toLowerCase().includes(searchLower) ||
        feed.description.toLowerCase().includes(searchLower) ||
        feed.pyth_lazer_id.toString().includes(searchLower)
      );
    });
  }, [priceFeeds, search]);

  const rows: RowConfig<Col>[] = filteredFeeds.map((priceFeed) => ({
    id: `${String(priceFeed.pyth_lazer_id)}-${priceFeed.symbol}`,
    data: {
      assetType: priceFeed.asset_type,
      description: (
        <span className={styles.description}>{priceFeed.description}</span>
      ),
      name: priceFeed.name,
      symbol: priceFeed.symbol,
      proId: priceFeed.pyth_lazer_id,
      exponent: priceFeed.exponent,
    },
  }));

  return (
    <div>
      <Input
        aria-label="Search price feeds"
        role="searchbox"
        type="text"
        placeholder="Search by symbol, name, description, or pyth pro id..."
        value={searchRaw}
        onChange={updateSearch}
        className="w-full p-2 mb-4 border border-gray-300 rounded-md"
      />
      <Table<Col>
        className={styles.table ?? ""}
        label="Pyth Pro price feed IDs"
        columns={PRICE_FEEDS_PRO_COLUMNS}
        rows={rows}
        isLoading={true}
        rounded
        fill
        stickyHeader="top"
      />
    </div>
  );
};

export function PriceFeedsProPriceIdTable() {
  const state = usePriceFeedsProPriceIdState();

  switch (state.type) {
    case PriceFeedsProPriceIdStateType.NotLoaded: {
      return <Spinner label="Loading Pyth Pro price feed IDs..." />;
    }
    case PriceFeedsProPriceIdStateType.Loading: {
      return <Spinner label="Loading Pyth Pro price feed IDs..." />;
    }
    case PriceFeedsProPriceIdStateType.Loaded: {
      return <LoadedPriceFeedsProPriceIdTable priceFeeds={state.priceFeeds} />;
    }
    case PriceFeedsProPriceIdStateType.Error: {
      return (
        <InfoBox title="Error" variant="error">
          Failed to load Pyth Pro price feed IDs.
        </InfoBox>
      );
    }
  }
}
