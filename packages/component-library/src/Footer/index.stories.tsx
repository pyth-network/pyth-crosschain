import type { Meta, StoryObj } from "@storybook/react";

import { Footer as FooterComponent } from "./index.js";

const meta = {
  component: FooterComponent,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {},
} satisfies Meta<typeof FooterComponent>;
export default meta;

export const Footer = {
  args: {},
} satisfies StoryObj<typeof FooterComponent>;
