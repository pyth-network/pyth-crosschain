import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./Button";
import { buttonVariants } from "./types";
import { IconControl } from "../../__stories__/helpers";
import { ThemeV2 } from "../../theme";

const meta = {
  title: "V2/Button",
  component: Button,
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
      options: Object.keys(ThemeV2.buttonSizes),
    },
    tooltipPositionerProps: { control: false },
    variant: {
      control: { type: "select" },
      options: buttonVariants,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
