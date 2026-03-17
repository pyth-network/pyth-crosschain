import * as Icon from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { Card as CardComponent, VARIANTS } from "./index.jsx";

const meta = {
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    footer: {
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
    icon: {
      control: "select",
      mapping: Object.fromEntries(
        Object.entries(Icon).map(([key, Icon]) => [
          key,
          <Icon key={key} weights={new Map()} />,
        ]),
      ),
      options: Object.keys(Icon),
      table: {
        category: "Contents",
      },
    },
    target: {
      control: "text",
      table: {
        category: "Link",
      },
    },
    title: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    toolbar: {
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
  },
  component: CardComponent,
  globals: {
    background: "primary",
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof CardComponent>;
export default meta;

export const Card = {
  args: {
    children: "This is a card!",
    footer: "",
    title: "",
    toolbar: "",
    variant: "secondary",
  },
} satisfies StoryObj<typeof CardComponent>;
