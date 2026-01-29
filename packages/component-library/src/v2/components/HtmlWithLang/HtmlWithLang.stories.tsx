import type { Meta, StoryObj } from "@storybook/react";

import { HtmlWithLang } from "./HtmlWithLang";

const meta = {
  title: "V2/HtmlWithLang",
  component: HtmlWithLang,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    children: { control: false },
  },
} satisfies Meta<typeof HtmlWithLang>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <HtmlWithLang {...args}>
      This is a rather boring story, but here I am, a full HTML body with some
      text.
    </HtmlWithLang>
  ),
};
