import type { Meta, StoryObj } from "@storybook/react";
import { ThemeProvider } from "next-themes";

import { Header as HeaderComponent } from "./index.jsx";

const meta = {
  component: HeaderComponent,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  globals: {
    background: "primary",
  },
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    appName: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof HeaderComponent>;
export default meta;

export const Header = {
  args: {
    appName: "Component Library",
  },
} satisfies StoryObj<typeof HeaderComponent>;
