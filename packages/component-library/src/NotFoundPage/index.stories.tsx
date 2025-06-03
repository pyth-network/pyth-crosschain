import type { Meta, StoryObj } from "@storybook/react";

import { NotFoundPage as NotFoundPageComponent } from "./index.jsx";

const meta = {
  component: NotFoundPageComponent,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof NotFoundPageComponent>;
export default meta;

type Story = StoryObj<typeof NotFoundPageComponent>;

export const Default: Story = {};