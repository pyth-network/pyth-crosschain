import * as Icon from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { Card as CardComponent, VARIANTS } from "./index.jsx";

const meta = {
  component: CardComponent,
  globals: {
    background: "primary",
  },
  parameters: {
    layout: "padded",
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
    title: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    icon: {
      control: "select",
      options: Object.keys(Icon),
      mapping: Object.fromEntries(
        Object.entries(Icon).map(([key, Icon]) => [
          key,
          <Icon weights={new Map()} key={key} />,
        ]),
      ),
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
    footer: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof CardComponent>;
export default meta;

export const Card = {
  args: {
    children: "This is a card!",
    variant: "secondary",
    title: "",
    toolbar: "",
    footer: "",
  },
} satisfies StoryObj<typeof CardComponent>;
