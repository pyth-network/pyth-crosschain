import { Gear, SignOut, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button";
import type { ActionMenuItem } from "./ActionsMenu";
import { ActionsMenu } from "./ActionsMenu";

const menuItems: ActionMenuItem[] = [
  {
    component: "Profile",
    icon: UserCircle,
    key: "profile",
  },
  {
    component: "Settings",
    icon: Gear,
    key: "settings",
  },
  {
    component: "Sign out",
    icon: SignOut,
    key: "sign-out",
  },
];

const meta = {
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
  component: ActionsMenu,
  title: "V2/ActionsMenu",
} satisfies Meta<typeof ActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
