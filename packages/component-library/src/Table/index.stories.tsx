import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Table as TableComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";
import { Badge } from "../Badge/index.jsx";
import { Button } from "../Button/index.jsx";
import { CopyButton } from "../CopyButton/index.jsx";
import { Status } from "../Status/index.jsx";

const meta = {
  title: "data & tables/Table",
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
      control: "text",
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
    stickyHeader: {
      control: "select",
      options: [undefined, "top", "appHeader"],
      table: {
        category: "Layout",
      },
    },
    dependencies: {
      table: {
        disable: true,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TableComponent>;
export default meta;

type Story = StoryObj<typeof TableComponent>;

// Basic example
export const Default: Story = {
  args: {
    label: "Price feeds table",
    columns: [
      {
        name: "PRICE FEED",
        id: "feed",
        isRowHeader: true,
      },
      {
        name: "PRICE",
        id: "price",
        fill: true,
      },
      {
        name: "CONFIDENCE",
        id: "confidence",
        alignment: "right",
      },
    ],
    rows: [
      {
        id: "BTC/USD",
        data: {
          feed: "BTC/USD",
          price: "$45,234.56",
          confidence: "±$12.34",
        },
      },
      {
        id: "ETH/USD",
        data: {
          feed: "ETH/USD",
          price: "$3,234.56",
          confidence: "±$2.34",
        },
      },
      {
        id: "SOL/USD",
        data: {
          feed: "SOL/USD",
          price: "$123.45",
          confidence: "±$0.12",
        },
      },
    ],
  },
};

// Column configurations
export const ColumnAlignments: Story = {
  args: {
    label: "Column alignments demo",
    fill: true,
    rounded: true,
    columns: [
      {
        name: "LEFT ALIGNED",
        id: "left",
        alignment: "left",
      },
      {
        name: "CENTER ALIGNED",
        id: "center",
        alignment: "center",
      },
      {
        name: "RIGHT ALIGNED",
        id: "right",
        alignment: "right",
      },
    ],
    rows: [
      {
        id: "1",
        data: {
          left: "Left text",
          center: "Center text",
          right: "Right text",
        },
      },
      {
        id: "2",
        data: {
          left: "Another left",
          center: "Another center",
          right: "Another right",
        },
      },
    ],
  },
};

export const ColumnWidths: Story = {
  args: {
    label: "Column widths demo",
    columns: [
      {
        name: "FIXED WIDTH",
        id: "fixed",
        width: 150,
      },
      {
        name: "FILL SPACE",
        id: "fill",
        fill: true,
      },
      {
        name: "SMALL",
        id: "small",
        width: 80,
      },
    ],
    rows: [
      {
        id: "1",
        data: {
          fixed: "150px width",
          fill: "This column fills the remaining space",
          small: "80px",
        },
      },
    ],
  },
};

export const StickyColumns: Story = {
  render: () => (
    <div className={styles.stickyColumnsWrapper}>
      <div className={styles.stickyColumnsInfo}>
        <p>Scroll horizontally to see the first column (NAME) remain sticky</p>
      </div>
      <div className={styles.stickyColumnsContainer}>
        <TableComponent
          label="Sticky column demo"
          columns={[
            {
              name: "NAME",
              id: "name",
              sticky: true,
              isRowHeader: true,
              width: 150,
            },
            {
              name: "SKU",
              id: "sku",
              width: 120,
            },
            {
              name: "DESCRIPTION",
              id: "description",
              width: 300,
            },
            {
              name: "CATEGORY",
              id: "category",
              width: 150,
            },
            {
              name: "SUBCATEGORY",
              id: "subcategory",
              width: 150,
            },
            {
              name: "BRAND",
              id: "brand",
              width: 120,
            },
            {
              name: "STATUS",
              id: "status",
              width: 120,
            },
            {
              name: "STOCK",
              id: "stock",
              width: 100,
              alignment: "right",
            },
            {
              name: "PRICE",
              id: "price",
              width: 100,
              alignment: "right",
            },
            {
              name: "DISCOUNT",
              id: "discount",
              width: 100,
              alignment: "right",
            },
            {
              name: "CREATED",
              id: "created",
              width: 120,
            },
            {
              name: "UPDATED",
              id: "updated",
              width: 120,
            },
            {
              name: "ACTIONS",
              id: "actions",
              width: 150,
              alignment: "center",
            },
          ]}
          rows={Array.from({ length: 8 }, (_, i) => ({
            id: `row-${i.toString()}`,
            data: {
              name: `Product ${String(i + 1)}`,
              sku: `SKU-${String(1000 + i)}`,
              description: `This is a detailed description for product ${String(i + 1)} that might be quite long`,
              category: `Category ${String((i % 3) + 1)}`,
              subcategory: `Subcat ${String((i % 2) + 1)}`,
              brand: `Brand ${String.fromCodePoint(65 + (i % 4))}`,
              status: (
                <Badge variant={i % 2 === 0 ? "success" : "warning"}>
                  {i % 2 === 0 ? "Active" : "Draft"}
                </Badge>
              ),
              stock: i * 10 + 5,
              price: `$${String((i + 1) * 99)}.99`,
              discount: i % 3 === 0 ? "10%" : "-",
              created: "2024-01-15",
              updated: "2024-12-01",
              actions: (
                <div className={styles.actions}>
                  <Button size="xs" variant="ghost">
                    Edit
                  </Button>
                  <Button size="xs" variant="ghost">
                    Delete
                  </Button>
                </div>
              ),
            },
          }))}
        />
      </div>
    </div>
  ),
};

// Loading states
export const Loading: Story = {
  args: {
    label: "Loading table",
    isLoading: true,
    columns: [
      {
        name: "NAME",
        id: "name",
        loadingSkeletonWidth: 80,
      },
      {
        name: "VALUE",
        id: "value",
        loadingSkeletonWidth: 20,
      },
      {
        name: "STATUS",
        id: "status",
        loadingSkeletonWidth: 35,
      },
    ],
  },
};

export const Updating: Story = {
  args: {
    label: "Updating table",
    isUpdating: true,
    columns: [
      {
        name: "METRIC",
        id: "metric",
      },
      {
        name: "VALUE",
        id: "value",
        alignment: "right",
      },
    ],
    rows: [
      {
        id: "cpu",
        data: {
          metric: "CPU Usage",
          value: "67%",
        },
      },
      {
        id: "memory",
        data: {
          metric: "Memory",
          value: "4.2 GB",
        },
      },
    ],
  },
};

// Interactive rows
export const ClickableRows: Story = {
  args: {
    label: "Clickable rows table",
    columns: [
      {
        name: "PROJECT",
        id: "project",
        isRowHeader: true,
      },
      {
        name: "STATUS",
        id: "status",
      },
      {
        name: "LAST UPDATED",
        id: "updated",
        alignment: "right",
      },
    ],
    rows: [
      {
        id: "project-1",
        href: "#project-1",
        data: {
          project: "Frontend App",
          status: <Status variant="success">Active</Status>,
          updated: "2 hours ago",
        },
      },
      {
        id: "project-2",
        href: "#project-2",
        data: {
          project: "Backend API",
          status: <Status variant="warning">Maintenance</Status>,
          updated: "1 day ago",
        },
      },
      {
        id: "project-3",
        onAction: fn(),
        data: {
          project: "Mobile App",
          status: <Status variant="info">Building</Status>,
          updated: "5 minutes ago",
        },
      },
    ],
  },
};

// Empty states
export const EmptyState: Story = {
  args: {
    label: "Empty table",
    columns: [
      { name: "NAME", id: "name" },
      { name: "VALUE", id: "value" },
    ],
    rows: [],
    emptyState: (
      <div className={styles.emptyState}>
        <icons.FolderOpen size={48} />
        <p>No data available</p>
        <Button size="sm">Add first item</Button>
      </div>
    ),
  },
};

export const EmptyStateHiddenHeaders: Story = {
  args: {
    label: "Empty table without headers",
    columns: [
      { name: "NAME", id: "name" },
      { name: "VALUE", id: "value" },
    ],
    rows: [],
    hideHeadersInEmptyState: true,
    emptyState: (
      <div className={styles.largeEmptyState}>
        <icons.MagnifyingGlass size={64} />
        <h3>No results found</h3>
        <p>Try adjusting your search or filters</p>
        <Button>Clear filters</Button>
      </div>
    ),
  },
};

// Complex data table
export const ComplexDataTable: Story = {
  args: {
    label: "User management table",
    fill: true,
    rounded: true,
    columns: [
      {
        name: "USER",
        id: "user",
        isRowHeader: true,
        sticky: true,
        width: 250,
      },
      {
        name: "ROLE",
        id: "role",
        width: 120,
      },
      {
        name: "STATUS",
        id: "status",
        width: 100,
      },
      {
        name: "LAST ACTIVE",
        id: "lastActive",
        width: 150,
      },
      {
        name: "ACTIONS",
        id: "actions",
        alignment: "right",
        width: 200,
      },
    ],
    rows: [
      {
        id: "user-1",
        data: {
          user: (
            <div className={styles.userCell}>
              <div className={styles.avatar}>JD</div>
              <div>
                <div className={styles.userName}>John Doe</div>
                <div className={styles.userEmail}>john@example.com</div>
              </div>
            </div>
          ),
          role: <Badge variant="info">Admin</Badge>,
          status: (
            <Status variant="success" size="xs">
              Active
            </Status>
          ),
          lastActive: "2 minutes ago",
          actions: (
            <div className={styles.actions}>
              <Button size="xs" variant="ghost">
                Edit
              </Button>
              <Button size="xs" variant="ghost">
                Delete
              </Button>
            </div>
          ),
        },
      },
      {
        id: "user-2",
        data: {
          user: (
            <div className={styles.userCell}>
              <div className={styles.avatar}>JS</div>
              <div>
                <div className={styles.userName}>Jane Smith</div>
                <div className={styles.userEmail}>jane@example.com</div>
              </div>
            </div>
          ),
          role: <Badge variant="neutral">Editor</Badge>,
          status: (
            <Status variant="success" size="xs">
              Active
            </Status>
          ),
          lastActive: "1 hour ago",
          actions: (
            <div className={styles.actions}>
              <Button size="xs" variant="ghost">
                Edit
              </Button>
              <Button size="xs" variant="ghost">
                Delete
              </Button>
            </div>
          ),
        },
      },
      {
        id: "user-3",
        data: {
          user: (
            <div className={styles.userCell}>
              <div className={styles.avatar}>RJ</div>
              <div>
                <div className={styles.userName}>Robert Johnson</div>
                <div className={styles.userEmail}>robert@example.com</div>
              </div>
            </div>
          ),
          role: <Badge variant="neutral">Viewer</Badge>,
          status: (
            <Status variant="disabled" size="xs">
              Inactive
            </Status>
          ),
          lastActive: "3 days ago",
          actions: (
            <div className={styles.actions}>
              <Button size="xs" variant="ghost">
                Activate
              </Button>
              <Button size="xs" variant="ghost">
                Delete
              </Button>
            </div>
          ),
        },
      },
    ],
  },
};

// Financial data table
export const FinancialDataTable: Story = {
  args: {
    label: "Portfolio holdings",
    columns: [
      {
        name: "ASSET",
        id: "asset",
        isRowHeader: true,
        sticky: true,
      },
      {
        name: "QUANTITY",
        id: "quantity",
        alignment: "right",
      },
      {
        name: "AVG COST",
        id: "avgCost",
        alignment: "right",
      },
      {
        name: "CURRENT PRICE",
        id: "currentPrice",
        alignment: "right",
      },
      {
        name: "VALUE",
        id: "value",
        alignment: "right",
      },
      {
        name: "P&L",
        id: "pnl",
        alignment: "right",
      },
      {
        name: "P&L %",
        id: "pnlPercent",
        alignment: "right",
      },
    ],
    rows: [
      {
        id: "btc",
        data: {
          asset: (
            <div className={styles.assetCell}>
              <strong>BTC</strong>
              <span className={styles.assetName}>Bitcoin</span>
            </div>
          ),
          quantity: "0.5234",
          avgCost: "$38,450",
          currentPrice: "$45,234",
          value: "$23,675",
          pnl: <span className={styles.positive}>+$3,548</span>,
          pnlPercent: <span className={styles.positive}>+17.6%</span>,
        },
      },
      {
        id: "eth",
        data: {
          asset: (
            <div className={styles.assetCell}>
              <strong>ETH</strong>
              <span className={styles.assetName}>Ethereum</span>
            </div>
          ),
          quantity: "5.123",
          avgCost: "$3,450",
          currentPrice: "$3,234",
          value: "$16,568",
          pnl: <span className={styles.negative}>-$1,106</span>,
          pnlPercent: <span className={styles.negative}>-6.3%</span>,
        },
      },
    ],
  },
};

// API data table with copy functionality
export const ApiEndpointsTable: Story = {
  args: {
    label: "API endpoints",
    columns: [
      {
        name: "ENDPOINT",
        id: "endpoint",
        isRowHeader: true,
        fill: true,
      },
      {
        name: "METHOD",
        id: "method",
        width: 80,
      },
      {
        name: "DESCRIPTION",
        id: "description",
        width: 300,
      },
      {
        name: "COPY",
        id: "copy",
        width: 60,
        alignment: "center",
      },
    ],
    rows: [
      {
        id: "get-price",
        data: {
          endpoint: <code>/api/v1/price/{`{symbol}`}</code>,
          method: (
            <Badge variant="success" size="xs">
              GET
            </Badge>
          ),
          description: "Get current price for a symbol",
          copy: <CopyButton text="/api/v1/price/{symbol}" />,
        },
      },
      {
        id: "post-order",
        data: {
          endpoint: <code>/api/v1/orders</code>,
          method: (
            <Badge variant="info" size="xs">
              POST
            </Badge>
          ),
          description: "Create a new order",
          copy: <CopyButton text="/api/v1/orders" />,
        },
      },
      {
        id: "delete-order",
        data: {
          endpoint: <code>/api/v1/orders/{`{id}`}</code>,
          method: (
            <Badge variant="error" size="xs">
              DELETE
            </Badge>
          ),
          description: "Cancel an existing order",
          copy: <CopyButton text="/api/v1/orders/{id}" />,
        },
      },
    ],
  },
};

// Sticky header example
export const StickyHeaderTable: Story = {
  render: () => (
    <div className={styles.stickyHeaderContainer}>
      <div className={styles.stickyHeaderInfo}>
        <p>Scroll down to see the sticky header in action</p>
      </div>
      <TableComponent
        label="Table with sticky header"
        stickyHeader="top"
        columns={[
          { name: "INDEX", id: "index", width: 80 },
          { name: "DATA", id: "data", fill: true },
        ]}
        rows={Array.from({ length: 50 }, (_, i) => ({
          id: `row-${i.toString()}`,
          data: {
            index: i + 1,
            data: `Row ${String(i + 1)} data - scroll to see sticky header`,
          },
        }))}
      />
    </div>
  ),
};

// Legacy export
export const Table = Default;
