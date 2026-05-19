import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { Button as ButtonComponent, SIZES, VARIANTS } from "./index.jsx";

const iconControl = {
  control: "select",
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
  options: Object.keys(icons),
} as const;

const meta = {
  argTypes: {
    afterIcon: {
      ...iconControl,
      table: {
        category: "Contents",
      },
    },
    beforeIcon: {
      ...iconControl,
      table: {
        category: "Contents",
      },
    },
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    hideText: {
      control: "boolean",
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
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isPending: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    rounded: {
      control: "boolean",
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
    target: {
      control: "text",
      table: {
        category: "Link",
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
  component: ButtonComponent,
} satisfies Meta<typeof ButtonComponent>;
export default meta;

export const Button = {
  args: {
    children: "Button",
    hideText: false,
    isDisabled: false,
    isPending: false,
    rounded: false,
    size: "md",
    variant: "primary",
  },
  argTypes: {
    onPress: {
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies StoryObj<typeof ButtonComponent>;

export const DrawerButton = {
  args: {
    children: "Open Drawer",
    drawer: {
      contents: "This is a drawer",
      title: "Hello world",
    },
    hideText: false,
    isDisabled: false,
    isPending: false,
    rounded: false,
    size: "md",
    variant: "primary",
  },
} satisfies StoryObj<typeof ButtonComponent>;

export const AlertButton = {
  args: {
    alert: {
      contents: "This is an alert",
      title: "Alert!",
    },
    children: "Open Alert",
    hideText: false,
    isDisabled: false,
    isPending: false,
    rounded: false,
    size: "md",
    variant: "primary",
  },
} satisfies StoryObj<typeof ButtonComponent>;
