import type { Meta, StoryObj } from "@storybook/react";

import {
  Status as StatusComponent,
  STATUS_VARIANTS,
  STATUS_SIZES,
  STATUS_STYLES,
} from "./index.jsx";

const meta = {
  component: StatusComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    variant: {
      control: "inline-radio",
      options: STATUS_VARIANTS,
      table: {
        category: "Variant",
      },
    },
    style: {
      control: "inline-radio",
      options: STATUS_STYLES,
      table: {
        category: "Variant",
      },
    },
    size: {
      control: "inline-radio",
      options: STATUS_SIZES,
      table: {
        category: "Variant",
      },
    },
  },
} satisfies Meta<typeof StatusComponent>;
export default meta;

export const Status = {
  args: {
    children: "A STATUS",
    variant: "neutral",
    style: "filled",
    size: "md",
  },
} satisfies StoryObj<typeof StatusComponent>;
