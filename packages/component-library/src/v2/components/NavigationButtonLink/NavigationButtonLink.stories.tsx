import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { NavigationButtonLink } from "./NavigationButtonLink";
import { IconControl } from "../../__stories__/helpers";

const meta = {
  title: "V2/NavigationButtonLink",
  component: NavigationButtonLink,
  args: {
    beforeIcon: ChartLine,
    children: "Price Feeds",
    href: "/price-feeds",
    onClick: (e) => {
      e.preventDefault();
    },
  },
  argTypes: {
    beforeIcon: {
      ...IconControl,
    },
    onClick: { action: "onClick" },
  },
} satisfies Meta<typeof NavigationButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
