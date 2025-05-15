import type { Meta, StoryObj } from "@storybook/react";

import { Link as LinkComponent } from "./index.jsx";

const meta = {
  component: LinkComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
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
    isDisabled: false,
    invert: false,
    drawer: {
      title: "Hello world",
      contents: "This is a drawer",
    },
  },
} satisfies StoryObj<typeof LinkComponent>;

export const AlertLink = {
  args: {
    children: "Open Alert",
    isDisabled: false,
    invert: false,
    alert: {
      title: "An alert",
      contents: "This is an alert",
    },
  },
} satisfies StoryObj<typeof LinkComponent>;
