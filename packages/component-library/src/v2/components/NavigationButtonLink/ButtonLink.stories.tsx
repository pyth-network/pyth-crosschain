import { ArrowSquareOut, ChartLine } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { IconControl } from "../../__stories__/helpers";
import { ButtonLink } from "./ButtonLink";

const meta = {
  args: {
    afterIcon: ArrowSquareOut,
    beforeIcon: ChartLine,
    children: "Head to Pyth",
    href: "https://pyth.network",
    target: "_blank",
  },
  argTypes: {
    afterIcon: {
      ...IconControl,
    },
    beforeIcon: {
      ...IconControl,
    },
  },
  component: ButtonLink,
  title: "V2/ButtonLink",
} satisfies Meta<typeof ButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
