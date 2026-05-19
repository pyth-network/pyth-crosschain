import type { Meta, StoryObj } from "@storybook/react";
import { ThemeV2 } from "../../theme";
import { Card } from "./Card";
import { cardElevations } from "./types";

const cardSizes = Object.keys(
  ThemeV2.sizes.card,
) as (keyof typeof ThemeV2.sizes.card)[];

const meta = {
  args: {
    children: "Card content",
    elevation: "default-1",
    size: "md",
  },
  argTypes: {
    children: { control: "text" },
    elevation: {
      control: { type: "select" },
      options: cardElevations,
    },
    size: {
      control: { type: "select" },
      options: cardSizes,
    },
  },
  component: Card,
  title: "V2/Card",
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Elevations: Story = {
  args: {
    children: undefined,
  },
  render: (args) => (
    <div style={{ display: "grid", gap: "1rem" }}>
      {cardElevations.map((elevation) => (
        <Card key={elevation} {...args} elevation={elevation}>
          {elevation}
        </Card>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  args: {
    children: undefined,
  },
  render: (args) => (
    <div style={{ display: "grid", gap: "1rem" }}>
      {cardSizes.map((size) => (
        <Card key={size} {...args} size={size}>
          {size}
        </Card>
      ))}
    </div>
  ),
};
