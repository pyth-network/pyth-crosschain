import type { Meta, StoryObj } from "@storybook/react";

import { Spinner } from "./Spinner";
import { ThemeV2 } from "../../theme";

const meta = {
  title: "V2/Spinner",
  component: Spinner,
  args: {
    size: "md",
    children: "Loading...",
  },
  argTypes: {
    size: {
      control: { type: "select" },
      options: Object.keys(ThemeV2.sizes.spinner),
    },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
