import type { Meta, StoryObj } from "@storybook/react";

import { Avatar } from "./Avatar";

const meta = {
  title: "V2/Avatar",
  component: Avatar,
  args: {
    user: {
      avatarUrl: "https://i.pravatar.cc/120?img=12",
      email: "sam.tanaka@pyth.network",
      fullName: "Sam Tanaka",
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FallbackInitials: Story = {
  args: {
    user: {
      email: "ava.lewis@pyth.network",
      fullName: "Ava Lewis",
    },
  },
};
