import type { Meta, StoryObj } from "@storybook/react";

import {
  SIZES,
  STYLES,
  Status as StatusComponent,
  VARIANTS,
} from "./index.jsx";

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
  component: StatusComponent,
} satisfies Meta<typeof StatusComponent>;
export default meta;

export const Status = {
  args: {
    children: "A STATUS",
    size: "md",
    style: "filled",
    variant: "neutral",
  },
} satisfies StoryObj<typeof StatusComponent>;
