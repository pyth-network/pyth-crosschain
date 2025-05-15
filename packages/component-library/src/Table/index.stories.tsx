import type { Meta, StoryObj } from "@storybook/react";

import { Table as TableComponent } from "./index.jsx";

const meta = {
  component: TableComponent,
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
} satisfies Meta<typeof TableComponent>;
export default meta;

export const Table = {
  args: {
    label: "A Table",
    isUpdating: false,
    isLoading: false,
    fill: true,
    rounded: true,
    columns: [
      {
        name: "PRICE FEED",
        id: "feed",
        isRowHeader: true,
        loadingSkeletonWidth: 16,
      },
      {
        name: "PRICE",
        id: "price",
        fill: true,
        loadingSkeletonWidth: 30,
      },
      {
        name: "CONFIDENCE",
        id: "confidence",
        loadingSkeletonWidth: 20,
        alignment: "right",
      },
    ],
    rows: [
      {
        id: "BTC/USD",
        href: "#",
        data: {
          feed: "BTC/USD",
          price: "$100,000",
          confidence: "+/- 5%",
        },
      },
      {
        id: "ETH/USD",
        href: "#",
        data: {
          feed: "ETH/USD",
          price: "$1,000",
          confidence: "+/- 10%",
        },
      },
      {
        id: "SOL/USD",
        href: "#",
        data: {
          feed: "SOL/USD",
          price: "$1,000,000,000",
          confidence: "+/- 0.1%",
        },
      },
    ],
  },
} satisfies StoryObj<typeof TableComponent>;
