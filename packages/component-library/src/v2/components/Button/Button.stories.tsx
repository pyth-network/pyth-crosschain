import type { Meta, StoryObj } from "@storybook/react";
import { IconControl } from "../../__stories__/helpers";
import { ThemeV2 } from "../../theme";
import { Button } from "./Button";
import { buttonVariants } from "./types";

const meta = {
  args: {
    children: "Button",
    size: "md",
    tooltip: "",
    variant: "primary",
  },
  argTypes: {
    afterIcon: {
      ...IconControl,
    },
    beforeIcon: {
      ...IconControl,
    },
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
  component: Button,
  title: "V2/Button",
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
