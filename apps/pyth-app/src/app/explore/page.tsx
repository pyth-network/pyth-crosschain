"use client";

import { Funnel } from "@phosphor-icons/react/dist/ssr/Funnel";
import { Button, Input, StatCard, TableGrid } from "@pythnetwork/component-library/v2";

type PriceFeedRow = {
  name: string;
  assetClass: string;
  priceFeedId: string;
  price: string;
  publishers: number;
};

const mockPriceFeeds: PriceFeedRow[] = [
  {
    name: "BTC/USD",
    assetClass: "Crypto",
    priceFeedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    price: "$104,250.00",
    publishers: 72,
  },
  {
    name: "ETH/USD",
    assetClass: "Crypto",
    priceFeedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    price: "$3,285.50",
    publishers: 68,
  },
  {
    name: "SOL/USD",
    assetClass: "Crypto",
    priceFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    price: "$245.80",
    publishers: 64,
  },
  {
    name: "EUR/USD",
    assetClass: "FX",
    priceFeedId: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
    price: "$1.0842",
    publishers: 45,
  },
  {
    name: "XAU/USD",
    assetClass: "Metal",
    priceFeedId: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
    price: "$2,715.30",
    publishers: 38,
  },
];

const columnDefs = [
  {
    headerName: "Name",
    field: "name" as const,
    flex: 1,
  },
  {
    headerName: "Asset Class",
    field: "assetClass" as const,
    flex: 1,
  },
  {
    headerName: "Price Feed ID",
    field: "priceFeedId" as const,
    flex: 2,
    cellRenderer: ({ value }: { value: string }) => (
      <span title={value}>{value.slice(0, 10)}...{value.slice(-6)}</span>
    ),
  },
  {
    headerName: "Price/Rate",
    field: "price" as const,
    flex: 1,
  },
  {
    headerName: "Publishers",
    field: "publishers" as const,
    flex: 1,
  },
];

export default function ExplorePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Explore</h1>

      <Input placeholder="Find the price of everything, everywhere..." size="lg" />
      <Button variant="ghost" size="sm" leftIcon={Funnel}>Add filter</Button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <StatCard header="Total Price Feeds" stat="512" variant="primary" />
        <StatCard header="Active Publishers" stat="94" />
        <StatCard header="Supported Chains" stat="65" />
        <StatCard header="Updates (24h)" stat="1.2M" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Price Feeds</h2>
        <TableGrid<PriceFeedRow>
          rowData={mockPriceFeeds}
          columnDefs={columnDefs}
        />
      </div>
    </div>
  );
}
