import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../Badge/index.jsx";
import { Button } from "../Button/index.jsx";
import { iconControl } from "../icon-control.jsx";
import { Card as CardComponent, VARIANTS } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  component: CardComponent,
  globals: {
    background: "primary",
  },
  parameters: {
    layout: "padded",
  },
  argTypes: {
    href: {
      control: "text",
      table: {
        category: "Link",
      },
    },
    target: {
      control: "text",
      table: {
        category: "Link",
      },
    },
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    variant: {
      control: "inline-radio",
      options: VARIANTS,
      table: {
        category: "Variant",
      },
    },
    title: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    icon: {
      ...iconControl,
      table: {
        category: "Contents",
      },
    },
    toolbar: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    footer: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CardComponent>;
export default meta;

export const Card = {
  args: {
    children: "This is a card!",
    variant: "secondary",
    title: "",
    toolbar: "",
    footer: "",
  },
} satisfies StoryObj<typeof CardComponent>;

type Story = StoryObj<typeof CardComponent>;

export const BasicCard: Story = {
  args: {
    children: (
      <p>
        This is a basic card with just content. It can contain any React elements
        and will display them with appropriate styling.
      </p>
    ),
    variant: "secondary",
  },
};

export const WithTitleAndIcon: Story = {
  args: {
    icon: <icons.Package />,
    title: "Product Details",
    children: (
      <div>
        <p>This card has a title and an icon in the header.</p>
        <p>Icons help users quickly identify the card's purpose.</p>
      </div>
    ),
    variant: "secondary",
  },
};

export const WithToolbar: Story = {
  args: {
    title: "User Statistics",
    toolbar: (
      <>
        <Button size="sm" variant="outline">
          <icons.DownloadSimple />
          Export
        </Button>
        <Button size="sm" variant="outline">
          <icons.ArrowsClockwise />
        </Button>
      </>
    ),
    children: (
      <div>
        <p>Total Users: 1,234</p>
        <p>Active Today: 567</p>
        <p>New This Week: 89</p>
      </div>
    ),
    variant: "secondary",
  },
};

export const WithFooter: Story = {
  args: {
    title: "Latest Activity",
    children: (
      <ul className={styles.activityList}>
        <li>User login at 10:30 AM</li>
        <li>Data sync completed at 10:15 AM</li>
        <li>Backup finished at 9:45 AM</li>
      </ul>
    ),
    footer: (
      <div className={styles.footerContent}>
        <span className={styles.footerText}>
          Last updated 5 minutes ago
        </span>
        <Button size="sm" variant="outline">
          View All
        </Button>
      </div>
    ),
    variant: "secondary",
  },
};

export const AsLink: Story = {
  args: {
    href: "#",
    icon: <icons.Link />,
    title: "Clickable Card",
    children: (
      <p>
        This entire card is clickable and will navigate to the specified URL.
        Hover over it to see the interactive state.
      </p>
    ),
    variant: "secondary",
  },
};

export const AsButton: Story = {
  args: {
    onPress: () => alert("Card clicked!"),
    icon: <icons.CursorClick />,
    title: "Interactive Card",
    children: (
      <p>
        This card acts as a button. Click anywhere on it to trigger an action.
      </p>
    ),
    variant: "secondary",
  },
};

export const CompleteExample: Story = {
  args: {
    icon: <icons.ChartBar />,
    title: "Revenue Dashboard",
    toolbar: (
      <>
        <Badge variant="success">Live</Badge>
        <Button size="sm" variant="ghost">
          <icons.DotsThree />
        </Button>
      </>
    ),
    children: (
      <div>
        <div className={styles.revenueContent}>
          <h3 className={styles.revenueHeading}>$45,234</h3>
          <p className={styles.revenueSubtext}>Total Revenue This Month</p>
        </div>
        <div className={styles.statsGrid}>
          <div>
            <p className={styles.statLabel}>Orders</p>
            <p className={styles.statValue}>152</p>
          </div>
          <div>
            <p className={styles.statLabel}>Avg. Value</p>
            <p className={styles.statValue}>$297.59</p>
          </div>
        </div>
      </div>
    ),
    footer: (
      <Button variant="primary" size="lg">
        View Detailed Report
      </Button>
    ),
    variant: "primary",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className={styles.variantsContainer}>
      {VARIANTS.map((variant) => (
        <CardComponent
          key={variant}
          variant={variant}
          title={`${variant.charAt(0).toUpperCase() + variant.slice(1)} Card`}
          icon={<icons.Info />}
        >
          <p>This is a {variant} variant card.</p>
        </CardComponent>
      ))}
    </div>
  ),
};
