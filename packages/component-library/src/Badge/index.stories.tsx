import type { Meta, StoryObj } from "@storybook/react";

import { Badge as BadgeComponent, VARIANTS, SIZES, STYLES } from "./index.jsx";

const meta = {
  component: BadgeComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    variant: {
      control: "inline-radio",
      options: VARIANTS,
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
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Variant",
      },
    },
  },
} satisfies Meta<typeof BadgeComponent>;
export default meta;

export const Badge = {
  args: {
    children: "A BADGE",
    variant: "neutral",
    style: "filled",
    size: "md",
  },
} satisfies StoryObj<typeof BadgeComponent>;
