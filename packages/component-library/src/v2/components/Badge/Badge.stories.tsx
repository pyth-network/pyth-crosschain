import type { Meta, StoryObj } from "@storybook/react";
import { ThemeV2 } from "../../theme";
import { Badge } from "./Badge";
import { BadgeSizes, BadgeStyles } from "./types";

const badgeVariants = Object.keys(
  ThemeV2.colors.states,
) as (keyof typeof ThemeV2.colors.states)[];

const meta = {
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
  component: Badge,
  parameters: {
    layout: "centered",
  },
  title: "V2/Badge",
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  args: {
    children: undefined,
  },
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {badgeVariants.map((variant) => (
        <Badge key={variant} {...args} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const Styles: Story = {
  args: {
    children: undefined,
  },
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {BadgeStyles.map((style) => (
        <Badge key={style} {...args} style={style}>
          {style}
        </Badge>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  args: {
    children: undefined,
  },
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {BadgeSizes.map((size) => (
        <Badge key={size} {...args} size={size}>
          {size}
        </Badge>
      ))}
    </div>
  ),
};
