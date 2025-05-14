import type { Meta, StoryObj } from "@storybook/react";

import { AppBody as AppShellComponent } from "./index.jsx";

const meta = {
  component: AppShellComponent,
  globals: {
    bare: true,
    theme: {
      disable: true,
    },
  },
  parameters: {
    layout: "fullscreen",
    themes: {
      disable: true,
    },
  },
  argTypes: {
    tabs: {
      table: {
        disable: true,
      },
    },
    appName: {
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
  },
} satisfies Meta<typeof AppShellComponent>;
export default meta;

export const AppShell = {
  args: {
    appName: "Component Library",
    children: "Hello world!",
    tabs: [
      { children: "Home", segment: "" },
      { children: "Foo", segment: "foo" },
      { children: "Bar", segment: "bar" },
    ],
  },
} satisfies StoryObj<typeof AppShellComponent>;
