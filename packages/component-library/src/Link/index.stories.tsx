import type { Meta, StoryObj } from "@storybook/react";

import { Link as LinkComponent } from "./index.js";

const meta = {
  component: LinkComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    href: {
      control: "text",
      table: {
        category: "Link",
      },
    },
    target: {
      control: "text",
      table: {
        category: "Link",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    invert: {
      control: "boolean",
      table: {
        category: "Link",
      },
    },
  },
} satisfies Meta<typeof LinkComponent>;
export default meta;

export const Link = {
  args: {
    children: "Link",
    href: "https://www.pyth.network",
    target: "_blank",
    isDisabled: false,
    invert: false,
  },
} satisfies StoryObj<typeof LinkComponent>;
