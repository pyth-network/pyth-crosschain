import type { Meta, StoryObj } from "@storybook/react";
import { Gear, SignOut, UserCircle } from "@phosphor-icons/react/dist/ssr";

import type { ActionMenuItem } from "../ActionsMenu";
import { LeftNav } from "./LeftNav";
import { LeftNavLink } from "../NavLink";

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
    <LeftNavLink href="/dashboard">Dashboard</LeftNavLink>
    <LeftNavLink href="/feeds" beforeIcon={UserCircle}>
      Feeds
    </LeftNavLink>
    <LeftNavLink href="/settings" beforeIcon={Gear}>
      Settings
    </LeftNavLink>
  </>
);

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
  render: (args) => (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <LeftNav {...args}>{args.children ?? defaultLinks}</LeftNav>
      <div style={{ flex: 1 }} />
    </div>
  ),
} satisfies Meta<typeof LeftNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: {
    collapsed: true,
  },
};
