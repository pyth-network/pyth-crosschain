import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { SingleToggleGroup as SingleToggleGroupComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  title: "forms & controls/SingleToggleGroup",
  component: SingleToggleGroupComponent,
  argTypes: {
    items: {
      table: {
        disable: true,
      },
    },
    onSelectionChange: {
      table: {
        category: "Behavior",
      },
    },
    selectedKey: {
      table: {
        category: "Selection",
      },
    },
    defaultSelectedKeys: {
      table: {
        category: "Selection",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
      table: {
        category: "Layout",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SingleToggleGroupComponent>;
export default meta;

type Story = StoryObj<typeof SingleToggleGroupComponent>;

export const Default: Story = {
  args: {
    items: [
      { id: "btc", children: "BTC" },
      { id: "sol", children: "SOL" },
      { id: "eth", children: "ETH" },
    ],
    defaultSelectedKeys: ["btc"],
  },
};

export const BasicCryptocurrencies: Story = {
  args: {
    items: [
      { id: "bitcoin", children: "Bitcoin" },
      { id: "solana", children: "Solana" },
      { id: "ethereum", children: "Ethereum" },
      { id: "avalanche", children: "Avalanche" },
    ],
    defaultSelectedKeys: ["bitcoin"],
  },
};

export const ViewToggle: Story = {
  args: {
    items: [
      { id: "grid", children: "Grid", "aria-label": "Grid view" },
      { id: "list", children: "List", "aria-label": "List view" },
      { id: "card", children: "Card", "aria-label": "Card view" },
    ],
    defaultSelectedKeys: ["grid"],
  },
};

export const WithIcons: Story = {
  args: {
    items: [
      {
        id: "grid",
        children: (
          <span className={styles.iconButton}>
            <icons.GridFour />
            Grid
          </span>
        ),
        "aria-label": "Grid view",
      },
      {
        id: "list",
        children: (
          <span className={styles.iconButton}>
            <icons.List />
            List
          </span>
        ),
        "aria-label": "List view",
      },
      {
        id: "table",
        children: (
          <span className={styles.iconButton}>
            <icons.Table />
            Table
          </span>
        ),
        "aria-label": "Table view",
      },
    ],
    defaultSelectedKeys: ["grid"],
  },
};

export const IconOnly: Story = {
  args: {
    items: [
      {
        id: "bold",
        children: <icons.TextBolder />,
        "aria-label": "Bold",
      },
      {
        id: "italic",
        children: <icons.TextItalic />,
        "aria-label": "Italic",
      },
      {
        id: "underline",
        children: <icons.TextUnderline />,
        "aria-label": "Underline",
      },
      {
        id: "strikethrough",
        children: <icons.TextStrikethrough />,
        "aria-label": "Strikethrough",
      },
    ],
    defaultSelectedKeys: ["bold"],
  },
};

export const TimeRanges: Story = {
  args: {
    items: [
      { id: "1h", children: "1H" },
      { id: "1d", children: "1D" },
      { id: "1w", children: "1W" },
      { id: "1m", children: "1M" },
      { id: "1y", children: "1Y" },
      { id: "all", children: "ALL" },
    ],
    defaultSelectedKeys: ["1d"],
  },
};

export const DisabledGroup: Story = {
  args: {
    items: [
      { id: "option1", children: "Option 1" },
      { id: "option2", children: "Option 2" },
      { id: "option3", children: "Option 3" },
    ],
    defaultSelectedKeys: ["option1"],
    isDisabled: true,
  },
};

export const DisabledIndividualItems: Story = {
  args: {
    items: [
      { id: "enabled1", children: "Enabled" },
      { id: "disabled", children: "Disabled", isDisabled: true },
      { id: "enabled2", children: "Enabled" },
    ],
    defaultSelectedKeys: ["enabled1"],
  },
};

export const SortingOptions: Story = {
  args: {
    items: [
      { id: "name", children: "Name" },
      { id: "date", children: "Date" },
      { id: "size", children: "Size" },
      { id: "type", children: "Type" },
    ],
    defaultSelectedKeys: ["name"],
  },
};

export const ChartTypes: Story = {
  args: {
    items: [
      {
        id: "line",
        children: (
          <span className={styles.iconButton}>
            <icons.ChartLine />
            Line
          </span>
        ),
      },
      {
        id: "bar",
        children: (
          <span className={styles.iconButton}>
            <icons.ChartBar />
            Bar
          </span>
        ),
      },
      {
        id: "pie",
        children: (
          <span className={styles.iconButton}>
            <icons.ChartPie />
            Pie
          </span>
        ),
      },
      {
        id: "area",
        children: (
          <span className={styles.iconButton}>
            <icons.ChartLineUp />
            Area
          </span>
        ),
      },
    ],
    defaultSelectedKeys: ["line"],
  },
};

export const NetworkSelection: Story = {
  args: {
    items: [
      { id: "mainnet", children: "Mainnet" },
      { id: "testnet", children: "Testnet" },
      { id: "devnet", children: "Devnet" },
    ],
    defaultSelectedKeys: ["mainnet"],
  },
};

export const LanguageSelector: Story = {
  args: {
    items: [
      { id: "en", children: "EN" },
      { id: "es", children: "ES" },
      { id: "fr", children: "FR" },
      { id: "de", children: "DE" },
      { id: "zh", children: "中" },
      { id: "ja", children: "日" },
    ],
    defaultSelectedKeys: ["en"],
  },
};

// Legacy export for backwards compatibility
export const SingleToggleGroup = Default;
