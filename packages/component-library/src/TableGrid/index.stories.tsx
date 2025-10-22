import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../Badge";
import { SymbolPairTag } from "../SymbolPairTag";
import { dummyRowData } from "./dummy-row-data";
import { TableGrid as TableGridComponent } from "./index.jsx";

const meta = {
  component: TableGridComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    columnDefs: {
      table: {
        disable: true,
      },
    },
    rowData: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    cardProps: {
      table: {
        category: "Outer Card",
      },
    },
    loading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
  },
} satisfies Meta<typeof TableGridComponent>;
export default meta;

const PriceCellRenderer = ({ value }: { value: number }) => (
  <span style={{ height: "100%", display: "flex", alignItems: "center" }}>
    {`$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`}
  </span>
);

const ConfidenceCellRenderer = ({ value }: { value: number }) => (
  <span
    style={{ height: "100%", display: "flex", alignItems: "center" }}
  >{`+/- ${value.toFixed(2)}%`}</span>
);

const FeedCellRenderer = ({ value }: { value: string }) => (
  <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
    <SymbolPairTag displaySymbol={value} icon={undefined} description={value} />
  </div>
);

const FeedCellRendererLoading = () => (
  <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
    <SymbolPairTag isLoading />
  </div>
);

const args = {
  columnDefs: [
    {
      headerName: "ID",
      field: "id",
    },
    {
      headerName: "PRICE FEED",
      field: "feed",
      cellRenderer: FeedCellRenderer,
      loadingCellRenderer: FeedCellRendererLoading,
      flex: 2,
    },
    {
      headerName: "PRICE",
      field: "price",
      flex: 3,
      cellRenderer: PriceCellRenderer,
    },
    {
      headerName: "CONFIDENCE",
      field: "confidence",
      cellRenderer: ConfidenceCellRenderer,
    },
  ],
  rowHeight: 70,
  rowData: dummyRowData,
};

export const TableGrid = {
  args,
} satisfies StoryObj<typeof TableGridComponent>;

export const PriceFeedsCard = {
  render: (props) => {
    return <TableGridComponent {...props} />;
  },
  args: {
    ...args,
    pagination: true,
    cardProps: {
      icon: <ChartLine />,
      title: (
        <>
          <span>Price Feeds</span>
          <Badge style="filled" variant="neutral" size="md">
            {args.rowData.length}
          </Badge>
        </>
      ),
    },
  },
} satisfies StoryObj<typeof TableGridComponent>;
