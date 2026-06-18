import type { Meta, StoryObj } from "@storybook/react";

import { Footer as FooterComponent } from "./index.jsx";

const meta = {
  argTypes: {},
  component: FooterComponent,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FooterComponent>;
export default meta;

export const Footer = {
  args: {},
} satisfies StoryObj<typeof FooterComponent>;
