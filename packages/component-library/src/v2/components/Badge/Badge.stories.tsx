import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./Badge";
import { BadgeSizes, BadgeStyles } from "./types";
import { ThemeV2 } from "../../theme";

const badgeVariants = Object.keys(
  ThemeV2.colors.states,
) as (keyof typeof ThemeV2.colors.states)[];

const meta = {
  title: "V2/Badge",
  component: Badge,
  args: {
    children: "Badge",
    size: "md",
    style: "filled",
    variant: "neutral",
  },
  argTypes: {
    children: { control: "text" },
    className: { control: false },
    size: {
      control: { type: "select" },
      options: BadgeSizes,
    },
    style: {
      control: { type: "select" },
      options: BadgeStyles,
    },
    variant: {
      control: { type: "select" },
      options: badgeVariants,
    },
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {badgeVariants.map((variant) => (
        <Badge key={variant} {...args} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
  args: {
    children: undefined,
  },
};

export const Styles: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {BadgeStyles.map((style) => (
        <Badge key={style} {...args} style={style}>
          {style}
        </Badge>
      ))}
    </div>
  ),
  args: {
    children: undefined,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {BadgeSizes.map((size) => (
        <Badge key={size} {...args} size={size}>
          {size}
        </Badge>
      ))}
    </div>
  ),
  args: {
    children: undefined,
  },
};
