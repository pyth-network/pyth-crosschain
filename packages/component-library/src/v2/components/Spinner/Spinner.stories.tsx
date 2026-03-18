import type { Meta, StoryObj } from "@storybook/react";
import { ThemeV2 } from "../../theme";
import { Spinner } from "./Spinner";

const meta = {
  args: {
    children: "Loading...",
    size: "md",
  },
  argTypes: {
    size: {
      control: { type: "select" },
      options: Object.keys(ThemeV2.sizes.spinner),
    },
  },
  component: Spinner,
  title: "V2/Spinner",
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
