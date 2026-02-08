import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { IconButton } from "./IconButton";
import { buttonVariants } from "./types";
import { IconControl } from "../../__stories__/helpers";
import { ThemeV2 } from "../../theme";

const meta = {
  title: "V2/Icon Button",
  component: IconButton,
  args: {
    icon: Plus,
    size: "md",
    tooltip: "",
    variant: "primary",
  },
  argTypes: {
    icon: { ...IconControl },
    onClick: { action: "onClick" },
    size: {
      control: { type: "select" },
      options: Object.keys(ThemeV2.sizes.button),
    },
    tooltipPositionerProps: { control: false },
    variant: {
      control: { type: "select" },
      options: buttonVariants,
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
