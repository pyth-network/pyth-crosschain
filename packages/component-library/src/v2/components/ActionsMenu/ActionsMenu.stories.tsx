import { Gear, SignOut, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import type { ActionMenuItem } from "./ActionsMenu";
import { ActionsMenu } from "./ActionsMenu";
import { Button } from "../Button";

const menuItems: ActionMenuItem[] = [
  {
    key: "profile",
    component: "Profile",
    icon: UserCircle,
  },
  {
    key: "settings",
    component: "Settings",
    icon: Gear,
  },
  {
    key: "sign-out",
    component: "Sign out",
    icon: SignOut,
  },
];

const meta = {
  title: "V2/ActionsMenu",
  component: ActionsMenu,
  args: {
    align: "start",
    children: <Button variant="outline">Open menu</Button>,
    menuItems,
    popoverTitle: "My Account",
    side: "bottom",
  },
  argTypes: {
    children: { control: false },
    menuItems: { control: false },
  },
} satisfies Meta<typeof ActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
