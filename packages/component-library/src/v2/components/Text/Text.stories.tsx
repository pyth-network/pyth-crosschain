import type { Meta, StoryObj } from "@storybook/react";

import { Text } from "./Text";
import { textColorTokens } from "./Text.styles";
import { ThemeV2 } from "../../theme";

const meta = {
  title: "V2/Text",
  component: Text,
  args: {
    children: "Sample text",
    italic: false,
  },
  argTypes: {
    bold: {
      control: { type: "select" },
      options: Object.keys(ThemeV2.tokens.fontWeights),
    },
    color: {
      control: { type: "select" },
      options: textColorTokens,
    },
    render: { control: false },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
