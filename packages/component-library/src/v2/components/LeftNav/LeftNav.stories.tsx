import { Gear, SignOut, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { ActionMenuItem } from "../ActionsMenu";
import { LeftNav } from "./LeftNav";
import { NavLink } from "../NavLink";

const actionMenuItems: ActionMenuItem[] = [
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

const defaultLinks = (
  <>
    <NavLink href="/dashboard">Dashboard</NavLink>
    <NavLink href="/feeds" beforeIcon={UserCircle}>
      Feeds
    </NavLink>
    <NavLink href="/settings" beforeIcon={Gear}>
      Settings
    </NavLink>
  </>
);

const LeftNavStory: Meta<typeof LeftNav>["render"] = (args) => {
  /** state */
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <LeftNav {...args} collapsed={collapsed} onCollapseChange={setCollapsed}>
        {args.children ?? defaultLinks}
      </LeftNav>
      <div style={{ flex: 1 }} />
    </div>
  );
};

const meta = {
  title: "V2/LeftNav",
  component: LeftNav,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    actionMenuItems,
    additionalUserMeta: "Admin",
    collapsed: false,
    currentUser: {
      avatarUrl: "https://i.pravatar.cc/120?img=32",
      email: "riley.chen@pyth.network",
      fullName: "Riley Chen",
    },
  },
  argTypes: {
    children: { control: false },
    onCollapseChange: { action: "onCollapseChange" },
  },
  render: LeftNavStory,
} satisfies Meta<typeof LeftNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: {
    collapsed: true,
  },
};
