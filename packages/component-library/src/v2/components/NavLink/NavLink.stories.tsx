import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { NavLink } from "./NavLink";
import { IconControl } from "../../__stories__/helpers";

const meta = {
  title: "V2/NavLink",
  component: NavLink,
  args: {
    beforeIcon: ChartLine,
    children: "Price Feeds",
    href: "/price-feeds",
  },
  argTypes: {
    beforeIcon: {
      ...IconControl,
    },
    onClick: { action: "onClick" },
  },
} satisfies Meta<typeof NavLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
