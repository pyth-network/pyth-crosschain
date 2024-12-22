import type { Meta, StoryObj } from "@storybook/react";

import { Drawer as DrawerComponent, DrawerTrigger } from "./index.js";
import { Button } from "../Button/index.js";

const meta = {
  component: DrawerComponent,
  decorators: [
    (Story) => (
      <DrawerTrigger>
        <Button>Click me!</Button>
        <Story />
      </DrawerTrigger>
    ),
  ],
  argTypes: {
    title: {
      control: "text",
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
    closeHref: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof DrawerComponent>;
export default meta;

export const Drawer = {
  args: {
    title: "A drawer",
    children: "This is a drawer",
  },
} satisfies StoryObj<typeof DrawerComponent>;
