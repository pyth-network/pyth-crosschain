import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { StatCard as StatCardComponent } from "./index.jsx";
import { Badge } from "../Badge/index.jsx";
import cardMeta, { Card as CardStory } from "../Card/index.stories.jsx";
import styles from "./index.stories.module.scss";

const cardMetaArgTypes = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { title, toolbar, icon, footer, ...argTypes } = cardMeta.argTypes;
  return argTypes;
};

const meta = {
  title: "data & tables/StatCard",
  component: StatCardComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    ...cardMetaArgTypes(),
    header: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    stat: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    miniStat: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    corner: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    small: {
      control: "boolean",
      table: {
        category: "Layout",
      },
    },
    header1: {
      table: {
        category: "Dual Layout",
      },
    },
    header2: {
      table: {
        category: "Dual Layout",
      },
    },
    stat1: {
      table: {
        category: "Dual Layout",
      },
    },
    stat2: {
      table: {
        category: "Dual Layout",
      },
    },
    miniStat1: {
      table: {
        category: "Dual Layout",
      },
    },
    miniStat2: {
      table: {
        category: "Dual Layout",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatCardComponent>;
export default meta;

const cardStoryArgs = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { title, toolbar, footer, ...args } = CardStory.args;
  return args;
};

type Story = StoryObj<typeof StatCardComponent>;

export const Default: Story = {
  args: {
    ...cardStoryArgs(),
    header: "Active Feeds",
    stat: "552",
    miniStat: "+5",
    variant: "secondary",
  },
};

export const BasicStats: Story = {
  args: {
    header: "Total Users",
    stat: "12,345",
    variant: "secondary",
  },
};

export const WithMiniStat: Story = {
  args: {
    header: "Revenue",
    stat: "$45,234",
    miniStat: "+12.5%",
    variant: "secondary",
  },
};

export const WithCorner: Story = {
  args: {
    header: "System Status",
    stat: "Online",
    corner: <Badge variant="success" size="xs">Live</Badge>,
    variant: "secondary",
  },
};

export const SmallVariant: Story = {
  args: {
    header: "CPU Usage",
    stat: "67%",
    miniStat: "+2.1%",
    small: true,
    variant: "secondary",
  },
};

export const CryptocurrencyPrices: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header="Bitcoin"
        stat="$43,892"
        miniStat="+2.34%"
        corner={<Badge variant="success" size="xs">+5.2%</Badge>}
        variant="secondary"
      />
      <StatCardComponent
        header="Ethereum" 
        stat="$2,847"
        miniStat="-1.23%"
        corner={<Badge variant="error" size="xs">-2.1%</Badge>}
        variant="secondary"
      />
      <StatCardComponent
        header="Solana"
        stat="$98.45"
        miniStat="+8.91%"
        corner={<Badge variant="success" size="xs">+12.8%</Badge>}
        variant="secondary"
      />
    </div>
  ),
};

export const BusinessMetrics: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header="Monthly Revenue"
        stat="$124,500"
        miniStat="+15.3% from last month"
        corner={<icons.TrendUp className={styles.greenIcon} />}
        variant="secondary"
      >
        <div className={styles.miniChart}>
          <span>Target: $120,000</span>
        </div>
      </StatCardComponent>
      <StatCardComponent
        header="Active Customers"
        stat="2,847"
        miniStat="+127 this week"
        corner={<icons.Users className={styles.blueIcon} />}
        variant="secondary"
      />
      <StatCardComponent
        header="Conversion Rate"
        stat="3.24%"
        miniStat="-0.12% from yesterday"
        corner={<icons.TrendDown className={styles.redIcon} />}
        variant="secondary"
      />
    </div>
  ),
};

export const SystemMonitoring: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header="CPU Usage"
        stat="67%"
        miniStat="Normal"
        corner={<Badge variant="warning" size="xs">High</Badge>}
        variant="secondary"
        small
      />
      <StatCardComponent
        header="Memory"
        stat="84%"
        miniStat="8.4 GB / 10 GB"
        corner={<Badge variant="error" size="xs">Critical</Badge>}
        variant="secondary"
        small
      />
      <StatCardComponent
        header="Disk Space"
        stat="45%"
        miniStat="450 GB / 1 TB"
        corner={<Badge variant="success" size="xs">OK</Badge>}
        variant="secondary"
        small
      />
      <StatCardComponent
        header="Network"
        stat="12.4 MB/s"
        miniStat="Upload: 2.1 MB/s"
        corner={<Badge variant="success" size="xs">Stable</Badge>}
        variant="secondary"
        small
      />
    </div>
  ),
};

export const DualLayout: Story = {
  args: {
    header1: "Inbound",
    header2: "Outbound", 
    stat1: "1,234",
    stat2: "856",
    miniStat1: "+12%",
    miniStat2: "-5%",
    variant: "secondary",
  },
};

export const DualLayoutComparison: Story = {
  args: {
    header1: "This Month",
    header2: "Last Month",
    stat1: "$45,234",
    stat2: "$39,876",
    miniStat1: "Revenue",
    miniStat2: "Revenue",
    variant: "secondary",
  },
};

export const DualLayoutMetrics: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header1="Sessions"
        header2="Bounce Rate"
        stat1="12,847"
        stat2="2.34%"
        miniStat1="+8.2%"
        miniStat2="-0.45%"
        variant="secondary"
      />
      <StatCardComponent
        header1="Page Views"
        header2="Avg. Duration"
        stat1="45,123"
        stat2="2m 34s"
        miniStat1="+12.5%"
        miniStat2="+15s"
        variant="secondary"
      />
    </div>
  ),
};

export const WithCustomContent: Story = {
  args: {
    header: "Sales Performance",
    stat: "98.5%",
    miniStat: "of monthly target",
    corner: <Badge variant="success" size="xs">On Track</Badge>,
    variant: "secondary",
    children: (
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            data-progress="98.5"
          />
        </div>
        <div className={styles.progressLabels}>
          <span>$98,500</span>
          <span>$100,000</span>
        </div>
      </div>
    ),
  },
};

export const AnalyticsDashboard: Story = {
  render: () => (
    <div className={styles.dashboard}>
      <div className={styles.mainStats}>
        <StatCardComponent
          header="Total Revenue"
          stat="$234,567"
          miniStat="+18.2% vs last month"
          corner={<Badge variant="success" size="xs">Target: 110%</Badge>}
          variant="primary"
        >
          <div className={styles.trendIndicator}>
            <icons.TrendUp className={styles.greenIcon} />
            <span>Trending upward for 3 months</span>
          </div>
        </StatCardComponent>
        <StatCardComponent
          header1="New Users"
          header2="Returning Users"
          stat1="3,456"
          stat2="8,921"
          miniStat1="+234 today"
          miniStat2="+567 today"
          variant="secondary"
        />
      </div>
      <div className={styles.secondaryStats}>
        <StatCardComponent
          header="Orders"
          stat="1,234"
          miniStat="+45 today"
          small
          variant="secondary"
        />
        <StatCardComponent
          header="Avg. Order"
          stat="$187"
          miniStat="+$12"
          small
          variant="secondary"
        />
        <StatCardComponent
          header="Conversion"
          stat="3.2%"
          miniStat="+0.3%"
          small
          variant="secondary"
        />
      </div>
    </div>
  ),
};

export const PythNetworkStats: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header="Price Feeds"
        stat="400+"
        miniStat="across all networks"
        corner={<Badge variant="success" size="xs">Live</Badge>}
        variant="secondary"
      >
        <div className={styles.networkBreakdown}>
          <div>Mainnet: 380</div>
          <div>Testnet: 25</div>
        </div>
      </StatCardComponent>
      <StatCardComponent
        header="Updates per Second"
        stat="8,500"
        miniStat="Peak: 12,000"
        corner={<icons.Lightning className={styles.yellowIcon} />}
        variant="secondary"
      />
      <StatCardComponent
        header1="Publishers"
        header2="Consumers"
        stat1="90+"
        stat2="200+"
        miniStat1="Data providers"
        miniStat2="Applications"
        variant="secondary"
      />
    </div>
  ),
};

export const ErrorStates: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header="Connection Status"
        stat="Offline"
        miniStat="Last seen: 2 hours ago"
        corner={<Badge variant="error" size="xs">Error</Badge>}
        variant="secondary"
      />
      <StatCardComponent
        header="Data Quality"
        stat="--"
        miniStat="No data available"
        corner={<Badge variant="neutral" size="xs">N/A</Badge>}
        variant="secondary"
      />
      <StatCardComponent
        header="Failed Requests"
        stat="127"
        miniStat="in the last hour"
        corner={<Badge variant="warning" size="xs">Alert</Badge>}
        variant="secondary"
      />
    </div>
  ),
};

export const LoadingStates: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatCardComponent
        header="Loading Data"
        stat={<div className={styles.skeleton}>Loading...</div>}
        miniStat="Please wait"
        variant="secondary"
      />
      <StatCardComponent
        header="Fetching Stats"
        stat="--"
        miniStat="Connecting..."
        corner={<div className={styles.spinner} />}
        variant="secondary"
      />
    </div>
  ),
};

// Legacy export for backwards compatibility
export const StatCard = Default;