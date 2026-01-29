import type { Meta, StoryObj } from "@storybook/react";

import { Dialog } from "./Dialog";
import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { Text } from "../Text";

const meta = {
  title: "V2/Dialog",
  component: Dialog,
  args: {
    open: true,
    onClose: () => {},
    title: "Update profile",
    saveAction: <Button variant="primary">Save changes</Button>,
  },
  argTypes: {
    children: { control: false },
    onClose: { action: "onClose" },
    onOpen: { action: "onOpen" },
    saveAction: { control: false },
  },
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => (
    <Dialog {...args}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Text>
          Keep your profile up to date to make sure account notifications reach
          the right inbox.
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Avatar
            user={{
              avatarUrl: "https://i.pravatar.cc/120?img=24",
              email: "alex.morgan@pyth.network",
              fullName: "Alex Morgan",
            }}
          />
          <div>
            <Text>Alex Morgan</Text>
            <Text>alex.morgan@pyth.network</Text>
          </div>
        </div>
        <Button variant="secondary">Send verification email</Button>
      </div>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
