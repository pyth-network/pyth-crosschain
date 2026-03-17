import type { Meta, StoryObj } from "@storybook/react";

import { Badge as BadgeComponent, SIZES, STYLES, VARIANTS } from "./index.jsx";

const meta = {
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Variant",
      },
    },
    style: {
      control: "inline-radio",
      options: STYLES,
      table: {
        category: "Variant",
      },
    },
    variant: {
      control: "inline-radio",
      options: VARIANTS,
      table: {
        category: "Variant",
      },
    },
  },
  component: BadgeComponent,
} satisfies Meta<typeof BadgeComponent>;
export default meta;

export const Badge = {
  args: {
    children: "A BADGE",
    size: "md",
    style: "filled",
    variant: "neutral",
  },
} satisfies StoryObj<typeof BadgeComponent>;
