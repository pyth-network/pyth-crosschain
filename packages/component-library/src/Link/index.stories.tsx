import type { Meta, StoryObj } from "@storybook/react";

import { Link as LinkComponent } from "./index.jsx";

const meta = {
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    invert: {
      control: "boolean",
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
  },
  component: LinkComponent,
} satisfies Meta<typeof LinkComponent>;
export default meta;

export const Link = {
  args: {
    children: "Link",
    href: "https://www.pyth.network",
    invert: false,
    isDisabled: false,
    target: "_blank",
  },
  argTypes: {
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
  },
} satisfies StoryObj<typeof LinkComponent>;

export const DrawerLink = {
  args: {
    children: "Open Drawer",
    drawer: {
      contents: "This is a drawer",
      title: "Hello world",
    },
    invert: false,
    isDisabled: false,
  },
} satisfies StoryObj<typeof LinkComponent>;

export const AlertLink = {
  args: {
    alert: {
      contents: "This is an alert",
      title: "An alert",
    },
    children: "Open Alert",
    invert: false,
    isDisabled: false,
  },
} satisfies StoryObj<typeof LinkComponent>;
