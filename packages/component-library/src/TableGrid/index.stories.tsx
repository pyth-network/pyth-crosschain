import type { Meta, StoryObj } from "@storybook/react";

import { TableGrid as TableGridComponent } from "./index.jsx";

const meta = {
  component: TableGridComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    columns: {
      table: {
        disable: true,
      },
    },
    rows: {
      table: {
        disable: true,
      },
    },
    renderEmptyState: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    label: {
      table: {
        category: "Accessibility",
      },
    },
    isUpdating: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isLoading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    fill: {
      control: "boolean",
      table: {
        category: "Variant",
      },
    },
    rounded: {
      control: "boolean",
      table: {
        category: "Variant",
      },
    },
    dependencies: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof TableGridComponent>;
export default meta;

export const TableGrid = {
  args: {
    colDefs: [
      {
        name: "PRICE FEED",
        field: "feed",
      },
      {
        name: "PRICE",
        field: "price",
        fill: true,
        loadingSkeletonWidth: 30,
      },
      {
        name: "CONFIDENCE",
        field: "confidence",
        loadingSkeletonWidth: 20,
      },
    ],
    rowData: [
      {
        feed: "BTC/USD",
          price: "$100,000",
          confidence: "+/- 5%",
      },
      {
        feed: "ETH/USD",
          price: "$1,000",
          confidence: "+/- 10%",
      },
      {
        feed: "SOL/USD",
          price: "$1,000,000,000",
          confidence: "+/- 0.1%",
      },
    ],
  },
} satisfies StoryObj<typeof TableGridComponent>;
