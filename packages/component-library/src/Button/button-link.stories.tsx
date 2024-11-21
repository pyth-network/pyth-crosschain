import type { Meta, StoryObj } from "@storybook/react";

import { ButtonLink as ButtonLinkComponent } from "./index.js";
import buttonMeta from "./index.stories.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { onPress, isPending, ...argTypes } = buttonMeta.argTypes;
const meta = {
  component: ButtonLinkComponent,
  title: "Button/ButtonLink",
  argTypes: {
    ...argTypes,
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
} satisfies Meta<typeof ButtonLinkComponent>;
export default meta;

export const ButtonLink = {
  args: {
    children: "Link",
    href: "https://www.pyth.network",
    target: "_blank",
    variant: "primary",
    size: "md",
    isDisabled: false,
    rounded: false,
    hideText: false,
  },
} satisfies StoryObj<typeof ButtonLinkComponent>;
