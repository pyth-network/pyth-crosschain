import { ArrowSquareOut, ChartLine } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { ButtonLink } from "./ButtonLink";
import { IconControl } from "../../__stories__/helpers";

const meta = {
  title: "V2/ButtonLink",
  component: ButtonLink,
  args: {
    afterIcon: ArrowSquareOut,
    beforeIcon: ChartLine,
    children: "Head to Pyth",
    href: "https://pyth.network",
    target: "_blank",
  },
  argTypes: {
    beforeIcon: {
      ...IconControl,
    },
    afterIcon: {
      ...IconControl,
    },
  },
} satisfies Meta<typeof ButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
